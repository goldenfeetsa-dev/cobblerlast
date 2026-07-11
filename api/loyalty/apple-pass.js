/**
 * GET /api/loyalty/apple-pass?member_number=NT-XXXX
 * يُصدر بطاقة Apple Wallet (.pkpass) حيّة دائماً (النقاط تُقرأ من قاعدة البيانات لحظة الطلب)،
 * فتظهر آخر تحديث عند إعادة إضافتها أو تنزيلها من جديد.
 */
import { findMember } from '../_lib/loyalty/loyaltyEngine.js';
import { buildApplePassBuffer, isApplePassConfigured } from '../_lib/loyalty/applePass.js';
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

export default async function handler(req, res) {
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
