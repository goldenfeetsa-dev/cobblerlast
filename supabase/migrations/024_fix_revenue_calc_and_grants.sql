-- ══════════════════════════════════════════════════════════════════
-- 024 — إصلاح احتساب الإيراد + تشديد الصلاحيات
-- ────────────────────────────────────────────────────────────────
-- ثغرتان حقيقيتان بـ get_monthly_financial_trend (018):
--  ١. كانت تجمع كل الطلبات بلا استثناء — يعني طلب "ملغى" أو "مُسترجع"
--     يُحتسب إيراد فعلي، فيضخّم رقم "كم لي" الظاهر بالتقارير.
--  ٢. GRANT EXECUTE ... TO anon — أي حد بدون تسجيل دخول يقدر يستدعي
--     الدالة ويشوف إجمالي إيراد المحل الشهري. صُححت لتتطلب دوراً مالياً
--     حقيقياً، بنفس مبدأ 019.
-- كذلك أضفنا خصم إشعارات الدائن/المدين المُصدرة فعلياً من الإيراد —
-- بدونها كان الإيراد المعروض يبقى كما هو حتى بعد إصدار إشعار دائن.
-- ══════════════════════════════════════════════════════════════════

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
      and (status is null or status::text not in ('cancelled', 'returned'))
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
  ),
  notes_agg as (
    select to_char(created_at, 'YYYY-MM') as month_key,
           sum(case when note_type = 'credit' then amount else -amount end) as net_credit
    from zatca_credit_debit_notes
    where created_at >= (select min(month_start) from months)
      and zatca_status = 'REPORTED'
    group by 1
  )
  select
    m.month_key,
    coalesce(o.revenue, 0) + coalesce(s.revenue, 0) - coalesce(n.net_credit, 0) as revenue,
    coalesce(e.amount, 0) as manual_expenses
  from months m
  left join orders_agg   o on o.month_key = m.month_key
  left join sales_agg    s on s.month_key = m.month_key
  left join expenses_agg e on e.month_key = m.month_key
  left join notes_agg    n on n.month_key = m.month_key
  order by m.month_key;
$$;

revoke execute on function get_monthly_financial_trend(int) from anon;
revoke execute on function get_monthly_financial_trend(int) from public;
grant execute on function get_monthly_financial_trend(int) to authenticated;
