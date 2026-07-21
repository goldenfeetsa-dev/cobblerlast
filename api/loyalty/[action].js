/**
 * api/loyalty/[action].js
 * ──────────────────────────────────────────────────────────────────
 * دمج كل نقاط /api/loyalty/* (كانت 7 ملفات منفصلة: adjust-points,
 * apple-pass, create-member, google-pass, lookup, notifications, qr)
 * بدالة واحدة — لتقليل عدد الـ Serverless Functions (Vercel Hobby
 * يسمح بحد أقصى 12 لكل Deployment، وكنا تجاوزناه بعد إضافة
 * /api/auth و /api/secure).
 *
 * الملف الديناميكي [action].js يلتقط نفس المسارات القديمة بالضبط:
 *   /api/loyalty/qr              → action = 'qr'
 *   /api/loyalty/apple-pass      → action = 'apple-pass'
 *   /api/loyalty/lookup          → action = 'lookup'
 *   ...إلخ — الواجهة الأمامية ما تحتاج أي تعديل.
 */
import {
  adjustPoints,
  createLoyaltyMember,
  findMember,
  getMemberHistory,
  getMemberNotifications,
} from '../_lib/loyalty/loyaltyEngine.js';
import { buildApplePassBuffer, isApplePassConfigured } from '../_lib/loyalty/applePass.js';
import { isGoogleWalletConfigured, upsertLoyaltyObject } from '../_lib/loyalty/googleWallet.js';
import { generateQrPngBuffer } from '../_lib/loyalty/qrImage.js';
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

async function handleAdjustPoints(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { member_number, change_amount, reason, performed_by, performed_by_id } = req.body || {};
  if (!member_number || change_amount === undefined || change_amount === null) {
    return res.status(400).json({ error: 'الحقول المطلوبة: member_number و change_amount' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'سبب العملية مطلوب لسجل التدقيق' });
  }
  try {
    const result = await adjustPoints({
      memberNumber: member_number,
      changeAmount: Number(change_amount),
      reason,
      performedBy: performed_by,
      performedById: performed_by_id,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'تعذّر تعديل النقاط' });
  }
}

async function handleApplePass(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isApplePassConfigured()) {
    return res.status(501).json({
      error: 'بطاقات Apple Wallet غير مُفعّلة بعد — يلزم ضبط شهادات Apple على الخادم (راجع LOYALTY_SETUP.md)',
    });
  }
  const { member_number } = req.query || {};
  if (!member_number) return res.status(400).json({ error: 'member_number مطلوب' });
  try {
    const member = await findMember({ member_number });
    if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
    const supabase = getSupabaseAdmin();
    const { data: settings } = await supabase.from('loyalty_membership_settings').select('*').limit(1).single();
    const buffer = await buildApplePassBuffer(member, settings || {});
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${member.member_number}.pkpass"`);
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'تعذّر إصدار بطاقة Apple Wallet' });
  }
}

async function handleCreateMember(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { full_name, phone, email, user_id } = req.body || {};
  if (!full_name || !phone) {
    return res.status(400).json({ error: 'الحقول المطلوبة: full_name و phone' });
  }
  try {
    const result = await createLoyaltyMember({ full_name, phone, email, user_id });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'تعذّر إنشاء عضوية الولاء' });
  }
}

async function handleGooglePass(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isGoogleWalletConfigured()) {
    return res.status(501).json({
      error: 'بطاقات Google Wallet غير مُفعّلة بعد — يلزم ضبط حساب خدمة Google على الخادم (راجع LOYALTY_SETUP.md)',
    });
  }
  const { member_number } = req.query || {};
  if (!member_number) return res.status(400).json({ error: 'member_number مطلوب' });
  try {
    const member = await findMember({ member_number });
    if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
    const supabase = getSupabaseAdmin();
    const { data: settings } = await supabase.from('loyalty_membership_settings').select('*').limit(1).single();
    const { objectId, saveUrl } = await upsertLoyaltyObject(member, settings || {});
    if (objectId !== member.google_object_id) {
      await supabase.from('loyalty_members').update({ google_object_id: objectId }).eq('id', member.id);
    }
    return res.status(200).json({ saveUrl, objectId });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'تعذّر إصدار بطاقة Google Wallet' });
  }
}

async function handleLookup(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { member_number, phone, include } = req.query || {};
  if (!member_number && !phone) {
    return res.status(400).json({ error: 'يجب تمرير member_number أو phone' });
  }
  try {
    const member = await findMember({ member_number, phone });
    if (!member) return res.status(404).json({ error: 'لم يتم العثور على عضو بهذه البيانات' });
    const includeSet = new Set(String(include || 'history,notifications').split(','));
    const [history, notifications] = await Promise.all([
      includeSet.has('history') ? getMemberHistory(member.id) : Promise.resolve([]),
      includeSet.has('notifications') ? getMemberNotifications(member.id) : Promise.resolve([]),
    ]);
    return res.status(200).json({ member, history, notifications });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ أثناء البحث عن العضو' });
  }
}

async function handleNotifications(req, res) {
  if (req.method === 'GET') {
    const { member_number } = req.query || {};
    if (!member_number) return res.status(400).json({ error: 'member_number مطلوب' });
    const member = await findMember({ member_number });
    if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
    const notifications = await getMemberNotifications(member.id);
    return res.status(200).json({ notifications });
  }
  if (req.method === 'POST') {
    const { member_number, notification_id } = req.body || {};
    if (!member_number || !notification_id) {
      return res.status(400).json({ error: 'الحقول المطلوبة: member_number و notification_id' });
    }
    const member = await findMember({ member_number });
    if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('loyalty_member_notifications')
      .update({ is_read: true })
      .eq('id', notification_id)
      .eq('member_id', member.id);
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleQr(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { member_number } = req.query || {};
  if (!member_number) return res.status(400).json({ error: 'member_number مطلوب' });
  try {
    const member = await findMember({ member_number });
    if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
    const buffer = await generateQrPngBuffer(member.qr_code || `LOYALTY:${member.member_number}`);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'تعذّر توليد رمز QR' });
  }
}

const ROUTES = {
  'adjust-points': handleAdjustPoints,
  'apple-pass': handleApplePass,
  'create-member': handleCreateMember,
  'google-pass': handleGooglePass,
  lookup: handleLookup,
  notifications: handleNotifications,
  qr: handleQr,
};

export default async function handler(req, res) {
  const { action } = req.query || {};
  const route = ROUTES[action];
  if (!route) return res.status(404).json({ error: 'مسار غير معروف' });
  try {
    return await route(req, res);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ غير متوقع' });
  }
}
