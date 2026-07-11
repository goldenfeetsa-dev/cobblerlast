/**
 * المنطق المركزي لبرنامج الولاء بالنقاط — يُستخدم من كل نقاط النهاية في api/loyalty/*
 */
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { generateMemberNumber, computeMembershipLevel, buildQrPayload, levelLabelAr } from './memberUtils.js';
import { notifyMember } from './notify.js';
import { isGoogleWalletConfigured, upsertLoyaltyObject } from './googleWallet.js';
import { isApplePassConfigured } from './applePass.js';

async function getSettings(supabase) {
  const { data } = await supabase.from('loyalty_membership_settings').select('*').limit(1).single();
  return data || {};
}

/**
 * ينشئ عضو ولاء جديداً: رقم عضوية فريد + QR + محاولة إصدار بطاقة Google Wallet.
 * بطاقة Apple Wallet لا تُنشأ هنا (تحتاج شهادات وتوقيعاً)، بل تُصدَر عند الطلب
 * عبر GET /api/loyalty/apple-pass (نفس نمط "أنشئ عند الطلب" المتبع في ZATCA).
 */
export async function createLoyaltyMember({ full_name, email, phone, user_id }) {
  if (!full_name || !phone) throw new Error('الاسم الكامل ورقم الجوال مطلوبان');
  const supabase = getSupabaseAdmin();
  const settings = await getSettings(supabase);

  // تفادي تكرار عضو لنفس رقم الجوال
  const { data: existing } = await supabase.from('loyalty_members').select('*').eq('phone', phone).maybeSingle();
  if (existing) return { member: existing, alreadyExists: true };

  let member = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5 && !member; attempt++) {
    const memberNumber = generateMemberNumber();
    const qrCode = buildQrPayload(memberNumber);
    const { data, error } = await supabase
      .from('loyalty_members')
      .insert({
        user_id: user_id || null,
        member_number: memberNumber,
        full_name,
        email: email || null,
        phone,
        points: 0,
        membership_level: 'Bronze',
        apple_pass_id: memberNumber,
        qr_code: qrCode,
      })
      .select()
      .single();
    if (!error) {
      member = data;
    } else if (error.code === '23505') {
      lastError = error; // تعارض على member_number — أعد المحاولة برقم جديد
    } else {
      throw new Error(error.message);
    }
  }
  if (!member) throw new Error(lastError?.message || 'تعذّر توليد رقم عضوية فريد، حاول مجدداً');

  // إصدار بطاقة Google Wallet (اختياري — لا يُفشل إنشاء العضوية إن لم تُضبط بيانات جوجل)
  if (isGoogleWalletConfigured()) {
    try {
      const { objectId } = await upsertLoyaltyObject(member, settings);
      const { data: updated } = await supabase
        .from('loyalty_members')
        .update({ google_object_id: objectId })
        .eq('id', member.id)
        .select()
        .single();
      member = updated || member;
    } catch (err) {
      console.error('Google Wallet issue error on create:', err.message);
    }
  }

  await notifyMember(supabase, member.id, `مرحباً ${full_name}! تم إنشاء عضويتك في برنامج الولاء برقم ${member.member_number}.`, 'welcome');

  return {
    member,
    alreadyExists: false,
    appleConfigured: isApplePassConfigured(),
    googleConfigured: isGoogleWalletConfigured(),
  };
}

export async function findMember({ member_number, phone, id }) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('loyalty_members').select('*');
  if (member_number) query = query.eq('member_number', member_number.trim());
  else if (phone) query = query.eq('phone', phone.trim());
  else if (id) query = query.eq('id', id);
  else throw new Error('يجب توفير member_number أو phone أو id للبحث');

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMemberHistory(memberId, limit = 50) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('loyalty_points_transactions')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getMemberNotifications(memberId, limit = 20) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('loyalty_member_notifications')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * يضيف أو يخصم نقاطاً لعضو، يحدّث المستوى، يسجّل العملية، يزامن بطاقات
 * Apple/Google Wallet (إن كانت مُصدرة ومُضبوطة)، ويُرسل إشعاراً داخل الموقع.
 */
export async function adjustPoints({ memberId, memberNumber, changeAmount, reason, performedBy, performedById }) {
  if (!changeAmount || Number.isNaN(Number(changeAmount))) {
    throw new Error('قيمة النقاط غير صالحة');
  }
  const supabase = getSupabaseAdmin();
  const settings = await getSettings(supabase);

  const member = memberId
    ? await findMember({ id: memberId })
    : await findMember({ member_number: memberNumber });
  if (!member) throw new Error('العضو غير موجود');

  const newPoints = Math.max(0, member.points + Number(changeAmount));
  const newLevel = computeMembershipLevel(newPoints, settings);
  const leveledUp = newLevel !== member.membership_level;

  const { data: updatedMember, error: updateError } = await supabase
    .from('loyalty_members')
    .update({ points: newPoints, membership_level: newLevel })
    .eq('id', member.id)
    .select()
    .single();
  if (updateError) throw new Error(updateError.message);

  const { error: txError } = await supabase.from('loyalty_points_transactions').insert({
    member_id: member.id,
    change_amount: Number(changeAmount),
    balance_after: newPoints,
    reason: reason || null,
    performed_by: performedBy || null,
    performed_by_id: performedById || null,
  });
  if (txError) throw new Error(txError.message);

  // تحديث بطاقة Google Wallet
  let googleSync = { attempted: false, ok: false };
  if (isGoogleWalletConfigured()) {
    googleSync.attempted = true;
    try {
      const { objectId } = await upsertLoyaltyObject(updatedMember, settings);
      if (objectId !== updatedMember.google_object_id) {
        await supabase.from('loyalty_members').update({ google_object_id: objectId }).eq('id', member.id);
      }
      googleSync.ok = true;
    } catch (err) {
      console.error('Google Wallet sync error on points update:', err.message);
      googleSync.error = err.message;
    }
  }
  // ملاحظة: بطاقة Apple Wallet لا تدعم "دفع" تحديث تلقائي بدون خادم Web Service
  // مُسجَّل (APNs)؛ لذلك تُعاد بطاقة Apple Wallet محدَّثة عند إعادة تنزيلها من
  // GET /api/loyalty/apple-pass (النقاط تُقرأ دائماً حيّة من قاعدة البيانات).

  const changeText = Number(changeAmount) > 0 ? `تمت إضافة ${changeAmount} نقطة` : `تم خصم ${Math.abs(changeAmount)} نقطة`;
  const message = leveledUp
    ? `${changeText} إلى رصيدك. رصيدك الحالي ${newPoints} نقطة، وتمت ترقيتك إلى المستوى ${levelLabelAr(newLevel)} 🎉`
    : `${changeText} إلى رصيدك. رصيدك الحالي ${newPoints} نقطة.`;
  await notifyMember(supabase, member.id, message, leveledUp ? 'level_up' : 'points_update');

  return { member: updatedMember, leveledUp, googleSync };
}
