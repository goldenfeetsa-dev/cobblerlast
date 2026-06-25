/**
 * loyalty-wallet Edge Function
 * POST /loyalty-wallet
 * 
 * Actions:
 *   - issue:  إصدار بطاقة جديدة أو جلب موجودة
 *   - stamp:  إضافة ختمة بعد كل خدمة
 *   - redeem: استرداد خدمة مجانية
 *   - get:    جلب بيانات البطاقة برقم الجوال
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.9/mod.ts';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_ISSUER_ID   = Deno.env.get('GOOGLE_WALLET_ISSUER_ID')!;
const GOOGLE_CLASS_SUFFIX = Deno.env.get('GOOGLE_WALLET_CLASS_SUFFIX') || 'cobblerlast_loyalty';
const GOOGLE_SA_EMAIL    = Deno.env.get('GOOGLE_SA_EMAIL')!;
const GOOGLE_SA_KEY      = Deno.env.get('GOOGLE_SA_KEY')!; // PEM private key

const CLASS_ID = `${GOOGLE_ISSUER_ID}.${GOOGLE_CLASS_SUFFIX}`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Google Auth ────────────────────────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Import the PEM key
  const pemKey = GOOGLE_SA_KEY.replace(/\\n/g, '\n');
  const keyData = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: GOOGLE_SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const jwt = await create(header, payload, cryptoKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Google Wallet Class (تُنشأ مرة واحدة) ───────────────────
async function ensureClass(token: string, settings: any) {
  const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${CLASS_ID}`;
  const check = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (check.status === 200) return; // موجودة مسبقاً

  const loyaltyClass = {
    id: CLASS_ID,
    issuerName: settings.program_name || 'إبرة وخيط الإسكافي',
    programName: settings.program_name || 'بطاقة الولاء',
    programLogo: {
      sourceUri: { uri: settings.brand_logo_url || 'https://cobblerlast.com/logo.png' },
      contentDescription: { defaultValue: { language: 'ar', value: 'شعار إبرة وخيط' } },
    },
    rewardsTier: 'عميل مميز',
    rewardsTierLabel: 'المستوى',
    loyaltyPoints: {
      label: 'ختمات',
      balance: { type: 'POINTS' },
    },
    secondaryLoyaltyPoints: {
      label: `كل ${settings.free_after || 3} ختمات = خدمة مجانية`,
    },
    hexBackgroundColor: settings.brand_color || '#1A0F00',
    countryCode: 'SA',
    reviewStatus: 'UNDER_REVIEW',
  };

  await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(loyaltyClass),
  });
}

// ── Google Wallet Object (بطاقة عميل) ──────────────────────
function buildObjectId(phone: string) {
  return `${CLASS_ID}.${phone.replace(/\D/g, '')}`;
}

async function createOrUpdateObject(token: string, card: any, settings: any) {
  const objectId = buildObjectId(card.customer_phone);
  const freeAfter = settings.free_after || 3;
  const stamps = card.stamps || 0;
  const remaining = freeAfter - (stamps % freeAfter);
  const hasFree = stamps > 0 && stamps % freeAfter === 0;

  const obj = {
    id: objectId,
    classId: CLASS_ID,
    state: 'ACTIVE',
    accountId: card.customer_phone,
    accountName: card.customer_name,
    loyaltyPoints: {
      balance: { string: `${stamps} / ${freeAfter}` },
      label: 'الختمات',
    },
    secondaryLoyaltyPoints: {
      balance: { string: hasFree ? '🎉 خدمة مجانية جاهزة!' : `متبقي ${remaining} خدمة` },
      label: 'المكافأة',
    },
    textModulesData: [
      {
        header: 'آخر خدمة',
        body: card.last_service_at
          ? new Date(card.last_service_at).toLocaleDateString('ar-SA')
          : 'لا يوجد بعد',
        id: 'last_service',
      },
      {
        header: 'إجمالي الخدمات',
        body: `${card.total_orders || 0} خدمة`,
        id: 'total_orders',
      },
    ],
    barcode: {
      type: 'QR_CODE',
      value: card.customer_phone,
      alternateText: card.customer_phone,
    },
    heroImage: settings.brand_logo_url
      ? { sourceUri: { uri: settings.brand_logo_url } }
      : undefined,
    hexBackgroundColor: settings.brand_color || '#1A0F00',
    infoModuleData: {
      labelValueRows: [
        {
          columns: [
            { label: 'العميل', value: card.customer_name },
            { label: 'الجوال', value: card.customer_phone },
          ],
        },
      ],
    },
    validTimeInterval: {
      start: { date: new Date().toISOString().split('T')[0] },
    },
  };

  // تحقق هل الـ object موجود
  const checkUrl = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`;
  const checkRes = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (checkRes.status === 200) {
    // تحديث الموجود
    await fetch(checkUrl, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    });
  } else {
    // إنشاء جديد
    await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    });
  }

  return objectId;
}

// ── توليد JWT لرابط "أضف لـ Google Wallet" ─────────────────
async function generatePassUrl(objectId: string, saEmail: string, saKey: string): Promise<string> {
  const pemKey = saKey.replace(/\\n/g, '\n');
  const keyData = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const payload = {
    iss: saEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: getNumericDate(0),
    payload: {
      loyaltyObjects: [{ id: objectId }],
    },
    origins: ['https://cobblerlast.com'],
  };

  const jwt = await create({ alg: 'RS256', typ: 'JWT' }, payload, cryptoKey);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

// ── Main Handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { action, phone, name, orderId, orderNumber, serviceType, amount } = await req.json();

    if (!phone) return new Response(JSON.stringify({ error: 'phone required' }), { status: 400, headers: cors });

    // جلب الإعدادات
    const { data: settingsArr } = await supabase.from('loyalty_settings').select('*').limit(1);
    const settings = settingsArr?.[0] || {};
    const freeAfter = settings.free_after || 3;

    // ── GET ──────────────────────────────────────────────
    if (action === 'get') {
      const { data: card } = await supabase
        .from('loyalty_cards')
        .select('*, loyalty_stamps(*)')
        .eq('customer_phone', phone)
        .single();
      return new Response(JSON.stringify({ card }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── ISSUE — إصدار/جلب البطاقة ────────────────────────
    if (action === 'issue') {
      let { data: card } = await supabase
        .from('loyalty_cards')
        .select('*')
        .eq('customer_phone', phone)
        .single();

      if (!card) {
        // إنشاء بطاقة جديدة
        const { data: newCard, error } = await supabase
          .from('loyalty_cards')
          .insert({ customer_phone: phone, customer_name: name || 'عميل', free_after: freeAfter })
          .select()
          .single();
        if (error) throw error;
        card = newCard;
      }

      // Google Wallet
      let passUrl = card.google_pass_url;
      if (!passUrl && GOOGLE_ISSUER_ID) {
        try {
          const token = await getGoogleAccessToken();
          await ensureClass(token, settings);
          const objectId = await createOrUpdateObject(token, card, settings);
          passUrl = await generatePassUrl(objectId, GOOGLE_SA_EMAIL, GOOGLE_SA_KEY);

          await supabase.from('loyalty_cards').update({
            google_object_id: objectId,
            google_pass_url: passUrl,
          }).eq('id', card.id);

          card.google_pass_url = passUrl;
        } catch (gErr) {
          console.error('Google Wallet error:', gErr);
          // لا نوقف العملية — البطاقة تشتغل بدون Google Wallet
        }
      }

      return new Response(JSON.stringify({ card, passUrl }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── STAMP — إضافة ختمة ───────────────────────────────
    if (action === 'stamp') {
      // جلب أو إنشاء البطاقة
      let { data: card } = await supabase
        .from('loyalty_cards')
        .select('*')
        .eq('customer_phone', phone)
        .single();

      if (!card) {
        const { data: newCard, error } = await supabase
          .from('loyalty_cards')
          .insert({ customer_phone: phone, customer_name: name || 'عميل', free_after: freeAfter })
          .select().single();
        if (error) throw error;
        card = newCard;
      }

      const newStamps    = card.stamps + 1;
      const newTotal     = card.total_orders + 1;
      const newSpent     = (card.total_spent || 0) + (amount || 0);
      const isFreeEarned = newStamps % freeAfter === 0;

      // تحديث البطاقة
      const { data: updatedCard } = await supabase
        .from('loyalty_cards')
        .update({
          stamps: newStamps,
          total_orders: newTotal,
          total_spent: newSpent,
          last_service_at: new Date().toISOString(),
        })
        .eq('id', card.id)
        .select().single();

      // سجّل الختمة
      await supabase.from('loyalty_stamps').insert({
        card_id: card.id,
        order_id: orderId,
        order_number: orderNumber,
        service_type: serviceType,
        amount,
        stamp_type: 'earned',
      });

      // تحديث Google Wallet
      if (updatedCard.google_object_id && GOOGLE_ISSUER_ID) {
        try {
          const token = await getGoogleAccessToken();
          await createOrUpdateObject(token, updatedCard, settings);
        } catch (gErr) {
          console.error('Google Wallet update error:', gErr);
        }
      }

      // إشعار في قائمة الإشعارات
      const msg = isFreeEarned
        ? `🎉 مبروك ${updatedCard.customer_name}! حصلت على خدمة مجانية في إبرة وخيط الإسكافي. أبرز هذه الرسالة عند زيارتك القادمة.`
        : `✂️ شكراً ${updatedCard.customer_name}! تم تسجيل خدمة جديدة. ختماتك: ${newStamps}/${freeAfter}. ${freeAfter - (newStamps % freeAfter)} خدمة للحصول على خدمة مجانية.`;

      await supabase.from('loyalty_notifications').insert({
        card_id: card.id,
        type: isFreeEarned ? 'free_service' : 'stamp_earned',
        message: msg,
      });

      return new Response(JSON.stringify({
        card: updatedCard,
        stamps: newStamps,
        isFreeEarned,
        remaining: freeAfter - (newStamps % freeAfter),
        message: msg,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── REDEEM — استرداد خدمة مجانية ────────────────────
    if (action === 'redeem') {
      const { data: card } = await supabase
        .from('loyalty_cards')
        .select('*')
        .eq('customer_phone', phone)
        .single();

      if (!card) return new Response(JSON.stringify({ error: 'البطاقة غير موجودة' }), { status: 404, headers: cors });
      if (card.stamps < freeAfter || card.stamps % freeAfter !== 0) {
        return new Response(JSON.stringify({ error: 'لا توجد خدمة مجانية متاحة بعد' }), { status: 400, headers: cors });
      }

      // طرح الختمات المستردة
      const { data: updatedCard } = await supabase
        .from('loyalty_cards')
        .update({ stamps: card.stamps - freeAfter })
        .eq('id', card.id)
        .select().single();

      await supabase.from('loyalty_stamps').insert({
        card_id: card.id,
        order_id: orderId,
        stamp_type: 'redeemed',
      });

      // تحديث Google Wallet
      if (updatedCard.google_object_id && GOOGLE_ISSUER_ID) {
        try {
          const token = await getGoogleAccessToken();
          await createOrUpdateObject(token, updatedCard, settings);
        } catch (gErr) { console.error('Google Wallet redeem error:', gErr); }
      }

      return new Response(JSON.stringify({ card: updatedCard, success: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'action not found' }), { status: 400, headers: cors });

  } catch (err) {
    console.error('loyalty-wallet error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
