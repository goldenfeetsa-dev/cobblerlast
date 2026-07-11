/**
 * POST /api/loyalty/adjust-points
 * body: { member_number, change_amount, reason, performed_by, performed_by_id }
 * change_amount: رقم موجب للإضافة، سالب للخصم.
 * يُستخدم حصراً من لوحة إدارة الولاء.
 */
import { adjustPoints } from '../_lib/loyalty/loyaltyEngine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { member_number, change_amount, reason, performed_by, performed_by_id } = req.body || {};
  if (!member_number || change_amount === undefined || change_amount === null) {
    return res.status(400).json({ error: 'الحقول المطلوبة: member_number و change_amount' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'سبب العملية مطلوب لسجل التدقيق' });
  }

  try {
    const result = await adjustPoints({
      memberNumber: member_number,
      changeAmount: Number(change_amount),
      reason,
      performedBy: performed_by,
      performedById: performed_by_id,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'تعذّر تعديل النقاط' });
  }
}
