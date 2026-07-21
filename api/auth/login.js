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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { pin } = req.body || {};
  if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ success: false, error: 'invalid_pin' });
  }

  try {
    // نمرّر IP المستخدم الحقيقي لدالة pos-login عشان تقييد المحاولات
    // (rate limiting) يفضل يشتغل حسب جهاز الزائر الفعلي، مو سيرفرنا.
    const forwardedFor = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/pos-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify({ pin }),
    });
    const result = await upstream.json();

    if (upstream.status === 429) {
      return res.status(429).json(result);
    }
    if (!upstream.ok || !result.success || !result.employee) {
      return res.status(upstream.status || 401).json(result);
    }

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
