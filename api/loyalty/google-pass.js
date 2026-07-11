/**
 * GET /api/loyalty/google-pass?member_number=NT-XXXX
 * يُنشئ/يحدّث بطاقة Google Wallet ويُعيد رابط "Add to Google Wallet" جاهزاً.
 */
import { findMember } from '../_lib/loyalty/loyaltyEngine.js';
import { isGoogleWalletConfigured, upsertLoyaltyObject } from '../_lib/loyalty/googleWallet.js';
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!isGoogleWalletConfigured()) {
    return res.status(501).json({
      error: 'بطاقات Google Wallet غير مُفعّلة بعد — يلزم ضبط حساب خدمة Google على الخادم (راجع LOYALTY_SETUP.md)',
    });
  }

  const { member_number } = req.query || {};
  if (!member_number) return res.status(400).json({ error: 'member_number مطلوب' });

  try {
    const member = await findMember({ member_number });
    if (!member) return res.status(404).json({ error: 'العضو غير موجود' });

    const supabase = getSupabaseAdmin();
    const { data: settings } = await supabase.from('loyalty_membership_settings').select('*').limit(1).single();

    const { objectId, saveUrl } = await upsertLoyaltyObject(member, settings || {});
    if (objectId !== member.google_object_id) {
      await supabase.from('loyalty_members').update({ google_object_id: objectId }).eq('id', member.id);
    }

    return res.status(200).json({ saveUrl, objectId });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'تعذّر إصدار بطاقة Google Wallet' });
  }
}
