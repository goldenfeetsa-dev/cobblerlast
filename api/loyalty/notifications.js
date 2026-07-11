/**
 * GET  /api/loyalty/notifications?member_number=NT-XXXX          → قائمة الإشعارات
 * POST /api/loyalty/notifications  { member_number, notification_id } → تعليم إشعار كمقروء
 */
import { findMember, getMemberNotifications } from '../_lib/loyalty/loyaltyEngine.js';
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { member_number } = req.query || {};
      if (!member_number) return res.status(400).json({ error: 'member_number مطلوب' });
      const member = await findMember({ member_number });
      if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
      const notifications = await getMemberNotifications(member.id);
      return res.status(200).json({ notifications });
    }

    if (req.method === 'POST') {
      const { member_number, notification_id } = req.body || {};
      if (!member_number || !notification_id) {
        return res.status(400).json({ error: 'الحقول المطلوبة: member_number و notification_id' });
      }
      const member = await findMember({ member_number });
      if (!member) return res.status(404).json({ error: 'العضو غير موجود' });

      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from('loyalty_member_notifications')
        .update({ is_read: true })
        .eq('id', notification_id)
        .eq('member_id', member.id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ في الإشعارات' });
  }
}
