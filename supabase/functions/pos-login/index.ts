/**
 * pos-login Edge Function
 * POST /pos-login   body: { pin: string }
 *
 * - يحسب محاولات الدخول الخاطئة حسب الـ IP الحقيقي للطلب (وليس بالمتصفح/sessionStorage
 *   الذي كان يمكن تجاوزه بمجرد فتح نافذة تصفح خفي أو مسح بيانات الموقع).
 * - يتحقق من رقم الـ PIN باستخدام service role على السيرفر فقط — المتصفح لا يستطيع
 *   أبداً قراءة عمود الـ PIN مباشرة (تم قطع صلاحية القراءة عنه في migration 006).
 *
 * إعدادات القفل: 5 محاولات خاطئة كحد أقصى لكل IP خلال 15 دقيقة.
 * بعد تجاوز الحد يُقفل الـ IP لمدة 15 دقيقة إضافية بغض النظر عن عدد محاولاته لاحقاً.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 دقيقة
const LOCK_MS       = 15 * 60 * 1000; // مدة القفل بعد تجاوز الحد

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getClientIp(req: Request): string {
  // Supabase Edge Functions (Deno Deploy) تمرر IP المستخدم الحقيقي في هذا الترويسة
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const ip = getClientIp(req);

  try {
    const { pin } = await req.json();

    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return json({ success: false, error: 'invalid_pin' }, 400);
    }

    const now = new Date();

    // ── جلب/إنشاء سجل محاولات هذا الـ IP ──────────────────────
    const { data: existing } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('ip', ip)
      .maybeSingle();

    if (existing?.locked_until && new Date(existing.locked_until) > now) {
      const remaining = Math.ceil((new Date(existing.locked_until).getTime() - now.getTime()) / 1000);
      return json({ success: false, error: 'rate_limited', retry_after_seconds: remaining }, 429);
    }

    let attempts = existing?.attempts || 0;
    let windowStart = existing?.window_start ? new Date(existing.window_start) : now;

    if (now.getTime() - windowStart.getTime() > WINDOW_MS) {
      attempts = 0;
      windowStart = now;
    }

    // ── التحقق من الـ PIN (service role — يتجاوز أي RLS) ─────
    const { data: match } = await supabase
      .from('employees')
      .select('id, name, role, avatar_url, is_active, branch_id, branch_name')
      .eq('pin', pin)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (match) {
      // نجاح: تصفير سجل المحاولات لهذا الـ IP
      await supabase.from('login_attempts').upsert({
        ip, attempts: 0, window_start: now.toISOString(), locked_until: null, updated_at: now.toISOString(),
      });
      return json({ success: true, employee: match });
    }

    // فشل: زيادة عداد المحاولات لهذا الـ IP
    attempts += 1;
    const locked_until = attempts >= MAX_ATTEMPTS
      ? new Date(now.getTime() + LOCK_MS).toISOString()
      : null;

    await supabase.from('login_attempts').upsert({
      ip, attempts, window_start: windowStart.toISOString(), locked_until, updated_at: now.toISOString(),
    });

    if (locked_until) {
      return json({ success: false, error: 'rate_limited', retry_after_seconds: LOCK_MS / 1000 }, 429);
    }

    return json({ success: false, error: 'invalid_pin', attempts_left: MAX_ATTEMPTS - attempts }, 401);
  } catch (e) {
    return json({ success: false, error: 'server_error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
