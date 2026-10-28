/**
 * POST /api/auth/login   body: { pin: string }
 * ──────────────────────────────────────────────────────────────────
 * يستدعي دالة pos-login (Supabase Edge Function) نفسها اللي تتحقق من
 * الـ PIN بأمان (rate limiting حسب IP + service role) — بدون تكرار
 * منطق التحقق. الفرق الوحيد: بدل ما نرجّع access_token/refresh_token
 * للمتصفح (يقدر أي كود XSS يقرأهم من localStorage)، نصدر كوكي HttpOnly
 * موقّعة والمتصفح ما يشوف أي توكن حساس إطلاقاً.
 */
import { buildSetCookieHeader, createSessionToken } from '../_lib/session.js';
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // تشخيص صريح: نذكر اسم المتغير الناقص فقط (بدون أي قيمة)
  const missing = [!process.env.SESSION_SECRET && 'SESSION_SECRET', !SUPABASE_URL && 'SUPABASE_URL', !process.env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean);
  if (missing.length) {
    console.error('api/auth/login: missing env', missing.join(','));
    return res.status(500).json({ success: false, error: 'config_missing' });
  }

  const { pin } = req.body || {};
  if (!pin || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ success: false, error: 'invalid_pin' });
  }

  try {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const hdr = (k) => String(req.headers[k] || '').trim();
    // IP موثوق: Cloudflare ثم x-real-ip ثم آخر عنصر في x-forwarded-for (الأول يقدر المهاجم يزوّره)
    const ip = hdr('cf-connecting-ip') || hdr('x-real-ip') || hdr('x-forwarded-for').split(',').pop().trim() || 'unknown';
    const keys = [`ip:${ip}`, 'global'];
    const limits = { [`ip:${ip}`]: 5, global: 25 };
    const WINDOW = 15 * 60 * 1000;

    const { data: rows } = await sb.from('login_attempts').select('*').in('ip', keys);
    const rec = Object.fromEntries((rows || []).map((r) => [r.ip, r]));
    for (const k of keys) {
      const r = rec[k];
      if (r?.locked_until && new Date(r.locked_until) > now) {
        return res.status(429).json({ success: false, error: 'rate_limited', retry_after_seconds: Math.ceil((new Date(r.locked_until) - now) / 1000) });
      }
    }

    // التحقق من الـ PIN داخل قاعدة البيانات (bcrypt) — لا يخرج أي PIN ولا hash للخادم
    const { data: match } = await sb.rpc('employee_login_by_pin', { p_pin: pin });

    if (!match) {
      let locked = false;
      for (const k of keys) {
        const r = rec[k];
        const fresh = !r?.window_start || now - new Date(r.window_start) > WINDOW;
        const attempts = (fresh ? 0 : r.attempts || 0) + 1;
        const lock = attempts >= limits[k];
        if (lock) locked = true;
        await sb.from('login_attempts').upsert({
          ip: k, attempts: lock ? 0 : attempts, window_start: fresh ? now.toISOString() : r.window_start,
          locked_until: lock ? new Date(now.getTime() + WINDOW).toISOString() : null, updated_at: now.toISOString(),
        });
      }
      if (locked) return res.status(429).json({ success: false, error: 'rate_limited', retry_after_seconds: WINDOW / 1000 });
      return res.status(401).json({ success: false, error: 'invalid_pin' });
    }
    await sb.from('login_attempts').upsert({ ip: `ip:${ip}`, attempts: 0, window_start: now.toISOString(), locked_until: null, updated_at: now.toISOString() });
    const result = { success: true, employee: match };

    const employee = result.employee;
    const token = createSessionToken({
      employeeId: employee.id,
      role: employee.role,
      name: employee.name,
      branchId: employee.branch_id,
    });

    res.setHeader('Set-Cookie', buildSetCookieHeader(token));
    // نرجّع فقط بيانات عرض غير حساسة — بدون أي توكن، بدون auth_user_id
    return res.status(200).json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        avatar_url: employee.avatar_url,
        branch_id: employee.branch_id,
        branch_name: employee.branch_name,
      },
    });
  } catch (err) {
    console.error('api/auth/login error', err);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
}
