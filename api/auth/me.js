/**
 * GET /api/auth/me
 * يتحقق من كوكي الجلسة (HttpOnly) ويرجّع بيانات العرض المرتبطة فعلياً
 * بها. تستخدمها الواجهة عند تحميل الصفحة للتأكد إن الجلسة المحلية
 * (localStorage، للعرض فقط) لسا متطابقة مع جلسة سيرفر حقيقية وسارية.
 */
import { getSessionFromRequest } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ authenticated: false });

  return res.status(200).json({
    authenticated: true,
    employee: {
      id: session.employee_id,
      name: session.name,
      role: session.role,
      branch_id: session.branch_id,
    },
  });
}
