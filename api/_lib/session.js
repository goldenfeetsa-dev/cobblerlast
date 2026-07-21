/**
 * api/_lib/session.js
 * ──────────────────────────────────────────────────────────────────
 * جلسة موقّعة (HMAC-SHA256) تُخزَّن كـ Cookie بخصائص:
 *   HttpOnly  → جافاسكربت بالمتصفح ما يقدر يقرأها إطلاقاً (يحميها من XSS)
 *   Secure    → ما تُرسل إلا عبر HTTPS
 *   SameSite=Strict → ما تُرسل مع أي طلب قادم من موقع خارجي (يمنع CSRF)
 *
 * هذي هي مصدر الحقيقة الوحيد لهوية الموظف المسجّل دخوله بالنسبة لأي
 * عملية تمر عبر /api/secure/* — الجافاسكربت بالمتصفح لا يرى التوكن
 * إطلاقاً، فحتى لو نجح مهاجم يحقن كود XSS بالصفحة، ما يقدر يسرق الجلسة.
 */
import crypto from 'node:crypto';

const COOKIE_NAME = 'nt_session';
const MAX_AGE_SECONDS = 12 * 60 * 60; // 12 ساعة — مدة وردية عمل معقولة

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET غير مضبوط على الخادم');
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
}

/** يُنشئ قيمة الكوكي الموقّعة لهذي الجلسة */
export function createSessionToken({ employeeId, role, name, branchId }) {
  const payload = {
    employee_id: employeeId,
    role,
    name,
    branch_id: branchId ?? null,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

/** يبني ترويسة Set-Cookie الآمنة بالكامل */
export function buildSetCookieHeader(token, { clear = false } = {}) {
  const attrs = [
    `${COOKIE_NAME}=${clear ? '' : token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    clear ? 'Max-Age=0' : `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  return attrs.join('; ');
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

/**
 * يتحقق من الجلسة الحالية من ترويسة الطلب. يرجّع null لو الكوكي غير
 * موجودة/موقّعة بشكل خاطئ/منتهية — مافيه أي "وضع افتراضي مسموح".
 */
export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw || !raw.includes('.')) return null;

  const [payloadB64, signature] = raw.split('.');
  const expected = sign(payloadB64);

  // مقارنة بزمن ثابت لمنع timing attacks على التوقيع
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

export { COOKIE_NAME };
