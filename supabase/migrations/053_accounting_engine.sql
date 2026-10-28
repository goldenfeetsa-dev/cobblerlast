-- ══════════════════════════════════════════════════════════════════
-- 053 — محرك المحاسبة الموحّد (Accounting Engine)
-- ══════════════════════════════════════════════════════════════════
-- المشكلة: كل صفحة مالية كانت تحسب الأرقام بطريقتها:
--   • التقارير المالية: ضريبة المبيعات = فواتير «مُبلَّغة لزاتكا» فقط (= صفر
--     دائماً لأننا بالمرحلة الأولى)، والمصاريف بالمبلغ الشامل للضريبة.
--   • لوحة الضرائب: ضريبة كل الفواتير الصادرة، وصافي الربح = إيراد − مشتريات − مصاريف.
--   • الرسم البياني: يحسب طلبات الشركات مرة ثانية بطريقة مختلفة.
-- النتيجة: ثلاثة أرقام مختلفة لنفس الشهر.
--
-- الحل: دالة واحدة هي مصدر الحقيقة لكل الأرقام المالية، يستدعيها الموقع
-- وتطبيق الجوال (Flutter) — فالرقم واحد في كل مكان.
--
-- أساس الاستحقاق (Accrual):
--   الإيراد (صافي بدون ضريبة):
--     • إصلاح: الطلبات غير الملغاة وغير التابعة لشركة، بتاريخ إنشائها.
--     • منتجات: فواتير المبيعات التي لا تحتوي بنود طلبات.
--     • شركات (B2B): فواتير المبيعات المجمّعة (تحتوي order_id) — تُحتسب مرة واحدة.
--     • إشعارات دائنة/مدينة صادرة: تخفض/تزيد الإيراد.
--   تكلفة الإيراد:
--     • تكلفة البضاعة المباعة = cost_total في فواتير المنتجات.
--     • مواد الورشة = التسوية الشهرية المعتمدة إن وُجدت، وإلا مسحوبات العهدة (تقديري).
--   المصاريف التشغيلية: صافي المصروف (الضريبة القابلة للخصم لا تُعتبر تكلفة،
--     وضريبة غير قابلة للخصم — بدون فاتورة ضريبية — تبقى تكلفة).
--   مشتريات المخزون: أصل (مخزون) لا تدخل الربح مباشرة؛ تدخل عند البيع/السحب.
--   ضريبة القيمة المضافة: نفس قواعد نموذج إقرار الهيئة (البند 13 = مخرجات − مدخلات).
--
-- الأمان: SECURITY DEFINER + search_path ثابت، ممنوعة على anon/authenticated،
-- وتُستدعى فقط عبر بوابة الخادم (/sb) بعد التحقق من دور مالي.
-- ══════════════════════════════════════════════════════════════════

create or replace function public.accounting_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz constant text := 'Asia/Riyadh';
  v_vat constant numeric := 0.15;
  v_out jsonb;
begin
  -- ── التحقق من المدخلات ──
  if p_from is null or p_to is null then
    raise exception 'period_required' using errcode = '22023';
  end if;
  if p_to < p_from then
    raise exception 'period_inverted' using errcode = '22023';
  end if;
  if p_to - p_from > 1100 then
    raise exception 'period_too_long' using errcode = '22023';
  end if;

  with
  -- ═══ مستندات الإيراد بالفترة ═══
  o as (
    select id, order_number as ref, coalesce(nullif(customer_name, ''), '—') as party,
           (created_at at time zone v_tz)::date as d,
           coalesce(subtotal, case when vat_amount is not null then total_price - vat_amount else total_price / (1 + v_vat) end, 0) as net,
           coalesce(vat_amount, coalesce(subtotal, total_price / (1 + v_vat), 0) * v_vat) as vat,
           payment_status
    from orders
    where partner_id is null
      and status is distinct from 'cancelled'
      and (created_at at time zone v_tz)::date between p_from and p_to
  ),
  s_all as (
    select id, invoice_number as ref,
           coalesce(nullif(buyer_company_name, ''), nullif(customer_name, ''), '—') as party,
           (created_at at time zone v_tz)::date as d,
           coalesce(subtotal, case when vat_amount is not null then total - vat_amount else total / (1 + v_vat) end, 0) as net,
           coalesce(vat_amount, coalesce(subtotal, total / (1 + v_vat), 0) * v_vat) as vat,
           coalesce(cost_total, 0) as cost,
           exists (
             select 1 from jsonb_array_elements(case when jsonb_typeof(items) = 'array' then items else '[]'::jsonb end) it
             where jsonb_typeof(it) = 'object' and it ? 'order_id'
           ) as is_partner
    from sales_invoices
    where (created_at at time zone v_tz)::date between p_from and p_to
  ),
  n as (
    select id, note_number as ref, note_type,
           (created_at at time zone v_tz)::date as d,
           case when note_type = 'credit' then -1 else 1 end as sgn,
           coalesce(amount, 0) - coalesce(vat_amount, 0) as net,
           coalesce(vat_amount, 0) as vat
    from zatca_credit_debit_notes
    where (created_at at time zone v_tz)::date between p_from and p_to
  ),
  -- ═══ المصاريف والمشتريات ═══
  e as (
    select id, category::text as category, coalesce(nullif(description, ''), category::text) as ref,
           expense_date as d,
           coalesce(amount, 0) as gross,
           case when coalesce(is_vat_applicable, false) and coalesce(has_tax_invoice, false)
                then coalesce(vat_amount, 0) else 0 end as vat_deductible
    from expenses
    where expense_date between p_from and p_to
  ),
  p as (
    select pi.id, pi.invoice_number as ref, coalesce(su.name, '—') as party, pi.invoice_date as d,
           coalesce(pi.taxable_amount, 0) as net,
           case when coalesce(pi.vat_number_valid_format, false) then coalesce(pi.vat_amount, 0) else 0 end as vat_deductible,
           coalesce(pi.vat_amount, 0) as vat
    from purchase_invoices pi
    left join suppliers su on su.id = pi.supplier_id
    where pi.invoice_date between p_from and p_to
  ),
  -- ═══ مواد الورشة (تسوية معتمدة أولاً، ثم مسحوبات غير مُسوّاة) ═══
  months as (
    select to_char(g, 'YYYY-MM') as mk
    from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') g
  ),
  settled as (
    select month_key, coalesce(total_workshop_cost, 0) as cost
    from workshop_settlements where month_key in (select mk from months)
  ),
  mat as (
    select
      coalesce((select sum(cost) from settled), 0) as settled_cost,
      coalesce((select sum(coalesce(c.total_cost, 0)) from workshop_custodies c
                where (c.created_at at time zone v_tz)::date between p_from and p_to
                  and (c.month_key is null or c.month_key not in (select month_key from settled))), 0) as raw_cost,
      exists (select 1 from workshop_custodies c
              where (c.created_at at time zone v_tz)::date between p_from and p_to
                and (c.month_key is null or c.month_key not in (select month_key from settled))) as estimated
  ),
  -- ═══ المجاميع ═══
  t as (
    select
      coalesce((select sum(net) from o), 0) as rev_repair,
      coalesce((select sum(net) from s_all where not is_partner), 0) as rev_products,
      coalesce((select sum(net) from s_all where is_partner), 0) as rev_partners,
      coalesce((select sum(sgn * net) from n), 0) as rev_adjust,
      coalesce((select sum(cost) from s_all where not is_partner), 0) as cogs,
      (select settled_cost + raw_cost from mat) as materials,
      (select estimated from mat) as materials_estimated,
      coalesce((select sum(gross - vat_deductible) from e), 0) as opex,
      coalesce((select sum(net) from p), 0) as purchases_net,
      coalesce((select sum(vat) from o), 0) + coalesce((select sum(vat) from s_all), 0) as vat_out_docs,
      coalesce((select sum(sgn * vat) from n), 0) as vat_out_adj,
      coalesce((select sum(vat_deductible) from p), 0) as vat_in_purchases,
      coalesce((select sum(vat_deductible) from e), 0) as vat_in_expenses,
      (select count(*) from o) + (select count(*) from s_all) as sales_docs,
      (select count(*) from e) as expense_docs,
      (select count(*) from p) as purchase_docs,
      (select count(*) from n) as note_docs
  ),
  -- ═══ أرصدة لحظية (غير مرتبطة بالفترة) ═══
  bal as (
    select
      coalesce((select sum(coalesce(total_price, 0)) from orders
                where payment_status = 'unpaid' and status is distinct from 'cancelled' and partner_invoice_id is null), 0)
      + coalesce((select sum(coalesce(total, 0)) from sales_invoices where payment_status = 'unpaid'), 0) as receivable,
      coalesce((select count(*) from orders
                where payment_status = 'unpaid' and status is distinct from 'cancelled' and partner_invoice_id is null), 0)
      + coalesce((select count(*) from sales_invoices where payment_status = 'unpaid'), 0) as receivable_docs,
      coalesce((select sum(coalesce(total_amount, coalesce(taxable_amount, 0) + coalesce(vat_amount, 0)) - coalesce(amount_paid, 0))
                from purchase_invoices where coalesce(payment_status, 'unpaid') <> 'paid'), 0) as payable,
      coalesce((select count(*) from purchase_invoices where coalesce(payment_status, 'unpaid') <> 'paid'), 0) as payable_docs
  ),
  -- ═══ الاتجاه الشهري: آخر 12 شهراً حتى شهر نهاية الفترة، بنفس القواعد ═══
  tm as (
    select to_char(g, 'YYYY-MM') as mk, g::date as ms, (g + interval '1 month' - interval '1 day')::date as me
    from generate_series(date_trunc('month', p_to) - interval '11 months', date_trunc('month', p_to), interval '1 month') g
  ),
  trend as (
    select tm.mk,
      round(
        coalesce((select sum(coalesce(subtotal, case when vat_amount is not null then total_price - vat_amount else total_price / (1 + v_vat) end, 0))
                  from orders where partner_id is null and status is distinct from 'cancelled'
                    and (created_at at time zone v_tz)::date between tm.ms and tm.me), 0)
      + coalesce((select sum(coalesce(subtotal, case when vat_amount is not null then total - vat_amount else total / (1 + v_vat) end, 0)) from sales_invoices
                  where (created_at at time zone v_tz)::date between tm.ms and tm.me), 0)
      + coalesce((select sum(case when note_type = 'credit' then -1 else 1 end * (coalesce(amount, 0) - coalesce(vat_amount, 0)))
                  from zatca_credit_debit_notes where (created_at at time zone v_tz)::date between tm.ms and tm.me), 0)
      , 2) as revenue,
      round(
        coalesce((select sum(coalesce(cost_total, 0)) from sales_invoices si
                  where (si.created_at at time zone v_tz)::date between tm.ms and tm.me
                    and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(si.items) = 'array' then si.items else '[]'::jsonb end) it
                                    where jsonb_typeof(it) = 'object' and it ? 'order_id')), 0)
      + coalesce((select total_workshop_cost from workshop_settlements ws where ws.month_key = tm.mk limit 1),
                 (select sum(coalesce(total_cost, 0)) from workshop_custodies c where (c.created_at at time zone v_tz)::date between tm.ms and tm.me), 0)
      + coalesce((select sum(coalesce(amount, 0) - case when coalesce(is_vat_applicable, false) and coalesce(has_tax_invoice, false) then coalesce(vat_amount, 0) else 0 end)
                  from expenses where expense_date between tm.ms and tm.me), 0)
      , 2) as costs
    from tm
  ),
  -- ═══ دفتر القيود المختصر للفترة (أحدث 400 حركة) ═══
  ledger as (
    select * from (
      select d, 'repair' as kind, ref, party, round(net, 2) as net, round(vat, 2) as vat, round(net + vat, 2) as total, 1 as sgn, payment_status as status from o
      union all
      select d, case when is_partner then 'partner' else 'product' end, ref, party, round(net, 2), round(vat, 2), round(net + vat, 2), 1, null from s_all
      union all
      select d, case when note_type = 'credit' then 'credit_note' else 'debit_note' end, ref, '—', round(net, 2), round(vat, 2), round(net + vat, 2), sgn, null from n
      union all
      select d, 'expense', ref, category, round(gross - vat_deductible, 2), round(vat_deductible, 2), round(gross, 2), -1, null from e
      union all
      select d, 'purchase', ref, party, round(net, 2), round(vat, 2), round(net + vat, 2), -1, null from p
    ) x
    order by d desc, ref desc
    limit 400
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'generated_at', now()),
    'income_statement', jsonb_build_object(
      'revenue_repair',   round(t.rev_repair, 2),
      'revenue_products', round(t.rev_products, 2),
      'revenue_partners', round(t.rev_partners, 2),
      'revenue_adjustments', round(t.rev_adjust, 2),
      'revenue_total',    round(t.rev_repair + t.rev_products + t.rev_partners + t.rev_adjust, 2),
      'cogs_products',    round(t.cogs, 2),
      'cogs_materials',   round(t.materials, 2),
      'materials_estimated', t.materials_estimated,
      'cost_of_revenue',  round(t.cogs + t.materials, 2),
      'gross_profit',     round(t.rev_repair + t.rev_products + t.rev_partners + t.rev_adjust - t.cogs - t.materials, 2),
      'operating_expenses', round(t.opex, 2),
      'net_profit',       round(t.rev_repair + t.rev_products + t.rev_partners + t.rev_adjust - t.cogs - t.materials - t.opex, 2),
      'net_margin_pct',   case when (t.rev_repair + t.rev_products + t.rev_partners + t.rev_adjust) > 0
                            then round((t.rev_repair + t.rev_products + t.rev_partners + t.rev_adjust - t.cogs - t.materials - t.opex)
                                       / (t.rev_repair + t.rev_products + t.rev_partners + t.rev_adjust) * 100, 1)
                            else null end
    ),
    'expenses_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'amount', round(amt, 2)) order by amt desc)
      from (select category, sum(gross - vat_deductible) as amt from e group by category) c
    ), '[]'::jsonb),
    'vat', jsonb_build_object(
      'output_vat',  round(t.vat_out_docs + t.vat_out_adj, 2),
      'input_vat',   round(t.vat_in_purchases + t.vat_in_expenses, 2),
      'input_vat_purchases', round(t.vat_in_purchases, 2),
      'input_vat_expenses',  round(t.vat_in_expenses, 2),
      'net_vat_due', round(t.vat_out_docs + t.vat_out_adj - t.vat_in_purchases - t.vat_in_expenses, 2),
      'taxable_sales', round(t.rev_repair + t.rev_products + t.rev_partners + t.rev_adjust, 2),
      'taxable_purchases', round(t.purchases_net, 2)
    ),
    'inventory_purchases', round(t.purchases_net, 2),
    'balances', jsonb_build_object(
      'receivable', round(bal.receivable, 2), 'receivable_docs', bal.receivable_docs,
      'payable', round(bal.payable, 2), 'payable_docs', bal.payable_docs
    ),
    'counts', jsonb_build_object('sales', t.sales_docs, 'expenses', t.expense_docs, 'purchases', t.purchase_docs, 'notes', t.note_docs),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('month', mk, 'revenue', revenue, 'costs', costs, 'net', round(revenue - costs, 2)) order by mk) from trend), '[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'kind', kind, 'ref', ref, 'party', party, 'net', net, 'vat', vat, 'total', total, 'sign', sgn, 'status', status) order by d desc, ref desc) from ledger), '[]'::jsonb)
  )
  into v_out
  from t, bal;

  return v_out;
end;
$$;

comment on function public.accounting_report(date, date) is
  'محرك المحاسبة الموحّد: قائمة الدخل، الضريبة، الأرصدة، الاتجاه، والدفتر — مصدر واحد للموقع وتطبيق الجوال.';

revoke all on function public.accounting_report(date, date) from public;
revoke all on function public.accounting_report(date, date) from anon, authenticated;
grant execute on function public.accounting_report(date, date) to service_role;
