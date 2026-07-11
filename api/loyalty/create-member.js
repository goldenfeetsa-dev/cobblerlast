/**
 * POST /api/loyalty/create-member
 * body: { full_name, phone, email?, user_id? }
 */
import { createLoyaltyMember } from '../_lib/loyalty/loyaltyEngine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { full_name, phone, email, user_id } = req.body || {};
  if (!full_name || !phone) {
    return res.status(400).json({ error: 'الحقول المطلوبة: full_name و phone' });
  }

  try {
    const result = await createLoyaltyMember({ full_name, phone, email, user_id });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'تعذّر إنشاء عضوية الولاء' });
  }
}
