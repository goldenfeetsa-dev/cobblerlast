/**
 * GET /api/loyalty/qr?member_number=NT-XXXX
 * يُعيد صورة QR الخاصة بالعضو كـ PNG مباشر (يُستخدم في <img src="/api/loyalty/qr?...">)
 */
import { findMember } from '../_lib/loyalty/loyaltyEngine.js';
import { generateQrPngBuffer } from '../_lib/loyalty/qrImage.js';

export default async function handler(req, res) {
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
