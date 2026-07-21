/**
 * /api/secure/zatca — إعدادات وسجلات زاتكا (بيانات ضريبية حساسة)
 * GET  ?resource=settings           → قراءة الإعدادات (دور مالي فقط)
 * GET  ?resource=log&needs_review=1 → قراءة سجل الفواتير المرفوضة/المعلّقة
 * POST ?resource=settings           → تحديث الإعدادات (دور مالي فقط)
 */
import { getSessionFromRequest } from '../_lib/session.js';
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

const FINANCE_ROLES = ['owner', 'admin', 'manager', 'accountant'];

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'unauthenticated' });
  if (!FINANCE_ROLES.includes(session.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const supabase = getSupabaseAdmin();
  const { resource = 'settings' } = req.query;

  try {
    if (req.method === 'GET' && resource === 'settings') {
      const { data, error } = await supabase.from('zatca_settings').select('*').eq('id', 1).single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'GET' && resource === 'log') {
      const { data, error } = await supabase
        .from('zatca_submission_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST' && resource === 'settings') {
      const record = req.body || {};
      const { data, error } = await supabase
        .from('zatca_settings')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('api/secure/zatca error', err);
    return res.status(500).json({ error: err.message || 'server_error' });
  }
}
