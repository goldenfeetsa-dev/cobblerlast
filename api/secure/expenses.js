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

// ── تنقية المدخلات ────────────────────────────────────────────────
// كانت الواجهة ترسل created_by = اسم الموظف بينما العمود uuid (مرتبط بجدول
// الموظفين) فيُرفض كل حفظ لمصروف. الحل: الخادم هو من يحدد المنشئ من الجلسة
// الموقّعة، ولا نقبل إلا حقولاً معروفة بقيم صحيحة.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ['rent', 'salaries', 'electricity', 'water', 'internet', 'marketing', 'maintenance', 'supplies', 'transportation', 'other'];
const money2 = (v) => Math.round(Number(v) * 100) / 100;

function cleanExpense(body, { partial = false } = {}) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);

  if (has('category') || !partial) {
    // قيم قديمة من الواجهة تُحوَّل لأقرب تصنيف صحيح بدل الرفض
    const c = b.category === 'utilities' ? 'electricity' : b.category;
    out.category = CATEGORIES.includes(c) ? c : 'other';
  }
  if (has('amount') || !partial) {
    const a = Number(b.amount);
    if (!Number.isFinite(a) || a <= 0 || a > 10_000_000) return { error: 'المبلغ غير صحيح' };
    out.amount = money2(a);
  }
  if (has('expense_date') || !partial) {
    const d = String(b.expense_date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return { error: 'التاريخ غير صحيح' };
    out.expense_date = d;
  }
  if (has('description')) out.description = String(b.description ?? '').slice(0, 500);
  if (has('is_vat_applicable')) out.is_vat_applicable = b.is_vat_applicable === true;
  if (has('has_tax_invoice')) out.has_tax_invoice = b.has_tax_invoice === true;
  if (has('vat_amount')) { const v = Number(b.vat_amount); out.vat_amount = Number.isFinite(v) && v >= 0 ? money2(v) : 0; }
  if (has('subtotal')) { const v = Number(b.subtotal); out.subtotal = Number.isFinite(v) && v >= 0 ? money2(v) : null; }
  if (has('supplier_vat_number')) {
    const v = b.supplier_vat_number == null ? '' : String(b.supplier_vat_number).trim();
    if (v && !/^3\d{13}3$/.test(v)) return { error: 'الرقم الضريبي للمورد غير صحيح' };
    out.supplier_vat_number = v || null;
  }
  if (has('receipt_url')) out.receipt_url = b.receipt_url ? String(b.receipt_url).slice(0, 1000) : null;
  // ضريبة بدون خضوع = تناقض: نصفّرها
  if (out.is_vat_applicable === false) { out.vat_amount = 0; out.has_tax_invoice = false; out.supplier_vat_number = null; }
  if (out.amount != null && out.vat_amount != null && out.vat_amount > out.amount) return { error: 'الضريبة أكبر من المبلغ' };
  return { record: out };
}

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
      const { record, error: bad } = cleanExpense(req.body);
      if (bad) return res.status(400).json({ error: bad });
      record.created_by = UUID.test(String(session.employee_id || '')) ? session.employee_id : null;
      if (UUID.test(String(session.branch_id || ''))) record.branch_id = session.branch_id;
      const { data, error } = await supabase.from(TABLE).insert(record).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'missing_id' });
      const { record, error: bad } = cleanExpense(req.body, { partial: true });
      if (bad) return res.status(400).json({ error: bad });
      if (!Object.keys(record).length) return res.status(400).json({ error: 'لا توجد حقول للتعديل' });
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
