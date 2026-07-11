/**
 * GET /api/loyalty/lookup?member_number=NT-XXXX  أو  ?phone=05xxxxxxxx
 * يُعيد بيانات العضو + آخر عمليات النقاط + الإشعارات غير المقروءة (اختياري عبر include=history,notifications)
 */
import { findMember, getMemberHistory, getMemberNotifications } from '../_lib/loyalty/loyaltyEngine.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { member_number, phone, include } = req.query || {};
  if (!member_number && !phone) {
    return res.status(400).json({ error: 'يجب تمرير member_number أو phone' });
  }

  try {
    const member = await findMember({ member_number, phone });
    if (!member) return res.status(404).json({ error: 'لم يتم العثور على عضو بهذه البيانات' });

    const includeSet = new Set(String(include || 'history,notifications').split(','));
    const [history, notifications] = await Promise.all([
      includeSet.has('history') ? getMemberHistory(member.id) : Promise.resolve([]),
      includeSet.has('notifications') ? getMemberNotifications(member.id) : Promise.resolve([]),
    ]);

    return res.status(200).json({ member, history, notifications });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ أثناء البحث عن العضو' });
  }
}
