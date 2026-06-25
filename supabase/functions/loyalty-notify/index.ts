/**
 * loyalty-notify Edge Function
 * يُرسل إشعارات SMS للعملاء عبر Twilio
 * 
 * يُستدعى:
 * 1. بعد كل ختمة (تلقائياً من loyalty-wallet)
 * 2. بـ cron job يومي للإشعارات المعلقة
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_SID       = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_FROM      = Deno.env.get('TWILIO_FROM_NUMBER') || '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── إرسال SMS عبر Twilio ────────────────────────────────────
async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.warn('Twilio not configured — skipping SMS');
    return false;
  }

  // تأكد من صيغة الجوال السعودي
  const phone = to.startsWith('+') ? to : `+966${to.replace(/^0/, '')}`;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: body }).toString(),
    }
  );

  const data = await res.json();
  if (data.sid) return true;
  console.error('Twilio error:', data);
  return false;
}

// ── Main ────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    const body = await req.json().catch(() => ({}));
    const { mode = 'pending' } = body; // 'pending' | 'single'

    // ── إرسال إشعار واحد بـ ID ──────────────────────────
    if (mode === 'single' && body.notification_id) {
      const { data: notif } = await supabase
        .from('loyalty_notifications')
        .select('*, loyalty_cards(customer_phone)')
        .eq('id', body.notification_id)
        .single();

      if (!notif) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: cors });

      const ok = await sendSMS(notif.loyalty_cards.customer_phone, notif.message);
      await supabase.from('loyalty_notifications').update({
        status: ok ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
      }).eq('id', notif.id);

      return new Response(JSON.stringify({ sent: ok }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── إرسال كل الإشعارات المعلقة (cron mode) ──────────
    const { data: pending } = await supabase
      .from('loyalty_notifications')
      .select('*, loyalty_cards(customer_phone, customer_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (!pending?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'لا يوجد إشعارات معلقة' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0, failed = 0;
    for (const notif of pending) {
      const ok = await sendSMS(notif.loyalty_cards.customer_phone, notif.message);
      await supabase.from('loyalty_notifications').update({
        status: ok ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
      }).eq('id', notif.id);
      ok ? sent++ : failed++;
      // انتظر قليلاً بين الرسائل لتجنب rate limit
      await new Promise(r => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('loyalty-notify error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
