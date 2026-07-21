/**
 * POST /api/auth/logout
 * يمسح كوكي الجلسة فعليًا من السيرفر (المتصفح لا يقدر يمسحها بنفسه
 * لأنها HttpOnly أصلاً — وهذا هو المقصود).
 */
import { buildSetCookieHeader } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  res.setHeader('Set-Cookie', buildSetCookieHeader(null, { clear: true }));
  return res.status(200).json({ success: true });
}
