/**
 * /api/secure/expenses — كل عمليات جدول expenses تمر من هنا فقط
 * ──────────────────────────────────────────────────────────────────
 * الجدول مقفول بالكامل بوجه anon/authenticated (migration 019+020) —
 * الوصول الوحيد المتاح هو عبر هذا المسار، اللي يتحقق من:
 *   1) كوكي الجلسة HttpOnly صالحة وموقّعة (المتصفح ما يقدر يزوّرها)
 *   2) الدور المرتبط بها فعلاً من نوع مالي (owner/admin/manager/accountant)
 * ثم ينفّذ العملية بمفتاح service_role (يتجاوز RLS لأنه مصدر موثوق
 * على مستوى السيرفر فقط، بعد التحقق أعلاه).
 */
import { getSessionFromRequest } from '../_lib/session.js';
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

const FINANCE_ROLES = ['owner', 'admin', 'manager', 'accountant'];
const FULL_ADMIN_ROLES = ['owner', 'admin', 'manager'];
const TABLE = 'expenses';

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'unauthenticated' });
  if (!FINANCE_ROLES.includes(session.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const supabase = getSupabaseAdmin();

  try {
    if (req.method === 'GET') {
      const { op = 'list', id, orderBy = '-expense_date', limit = '500', filters, gte_col, gte_val, lte_col, lte_val } = req.query;
      const lim = Math.min(parseInt(limit, 10) || 500, 2000); // سقف أعلى دفاعي حتى لو طُلب رقم ضخم

      if (op === 'get') {
        if (!id) return res.status(400).json({ error: 'missing_id' });
        const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      const col = String(orderBy).startsWith('-') ? String(orderBy).slice(1) : String(orderBy);
      const asc = !String(orderBy).startsWith('-');
      let query = supabase.from(TABLE).select('*').order(col, { ascending: asc }).limit(lim);

      if (gte_col && gte_val) query = query.gte(String(gte_col), String(gte_val));
      if (lte_col && lte_val) query = query.lte(String(lte_col), String(lte_val));

      if (op === 'filter' && filters) {
        let parsed;
        try { parsed = JSON.parse(String(filters)); } catch { return res.status(400).json({ error: 'invalid_filters' }); }
        for (const [key, val] of Object.entries(parsed)) {
          if (val === null) query = query.is(key, null);
          else if (Array.isArray(val)) query = query.in(key, val);
          else query = query.eq(key, val);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const record = req.body || {};
      const { data, error } = await supabase.from(TABLE).insert(record).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'missing_id' });
      const record = req.body || {};
      const { data, error } = await supabase.from(TABLE).update(record).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (!FULL_ADMIN_ROLES.includes(session.role)) return res.status(403).json({ error: 'forbidden' });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'missing_id' });
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ id });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('api/secure/expenses error', err);
    return res.status(500).json({ error: err.message || 'server_error' });
  }
}
