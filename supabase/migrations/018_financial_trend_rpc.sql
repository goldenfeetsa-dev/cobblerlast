-- ══════════════════════════════════════════════════════════
-- get_monthly_financial_trend
-- ──────────────────────────────────────────────────────────
-- يجمّع إيراد/مصاريف آخر N شهر داخل قاعدة البيانات مباشرة،
-- بدل ما يجيب الواجهة كل الصفوف الخام وتحسبها بـ JavaScript.
-- هذا يحوّل 18 استعلام (3 جداول × 6 أشهر) إلى استعلام واحد فقط،
-- ونفس صيغة الحساب المستخدمة بالضبط في FinancialReports.jsx:
--   إيراد = SUM(orders.subtotal أو total_price/1.15) + SUM(sales_invoices.subtotal)
--   مصاريف يدوية = SUM(expenses.amount)
-- ══════════════════════════════════════════════════════════

create or replace function get_monthly_financial_trend(months_count int default 6)
returns table (
  month_key text,
  revenue numeric,
  manual_expenses numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with months as (
    select to_char(date_trunc('month', current_date) - (n || ' months')::interval, 'YYYY-MM') as month_key,
           date_trunc('month', current_date) - (n || ' months')::interval as month_start
    from generate_series(0, greatest(months_count - 1, 0)) as n
  ),
  orders_agg as (
    select to_char(created_at, 'YYYY-MM') as month_key,
           sum(coalesce(subtotal, total_price / 1.15)) as revenue
    from orders
    where created_at >= (select min(month_start) from months)
    group by 1
  ),
  sales_agg as (
    select to_char(created_at, 'YYYY-MM') as month_key,
           sum(subtotal) as revenue
    from sales_invoices
    where created_at >= (select min(month_start) from months)
    group by 1
  ),
  expenses_agg as (
    select to_char(expense_date, 'YYYY-MM') as month_key,
           sum(amount) as amount
    from expenses
    where expense_date >= (select min(month_start) from months)
    group by 1
  )
  select
    m.month_key,
    coalesce(o.revenue, 0) + coalesce(s.revenue, 0) as revenue,
    coalesce(e.amount, 0) as manual_expenses
  from months m
  left join orders_agg   o on o.month_key = m.month_key
  left join sales_agg    s on s.month_key = m.month_key
  left join expenses_agg e on e.month_key = m.month_key
  order by m.month_key;
$$;

-- أي مستخدم لديه صلاحية الوصول للتطبيق يقدر يستدعيها (نفس صلاحيات القراءة الحالية)
grant execute on function get_monthly_financial_trend(int) to anon, authenticated;

-- فهرس إضافي يخدم التجميع الشهري في هذي الدالة تحديداً
create index if not exists idx_sales_invoices_created_at_brin on sales_invoices using brin (created_at);
