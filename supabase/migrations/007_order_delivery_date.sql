-- ══════════════════════════════════════════════════════════════
-- 007: تاريخ التسليم على مستوى الطلب
-- يضيف عمود delivery_date لجدول orders ليتم تنظيم جدول "المهام حسب اليوم"
-- (صفحة التقويم) بناءً على تاريخ التسليم الفعلي بدل تاريخ إنشاء الطلب.
-- ══════════════════════════════════════════════════════════════

alter table public.orders
  add column if not exists delivery_date date;

-- تعبئة تقديرية للطلبات القديمة التي لا تملك تاريخ تسليم بعد،
-- حتى لا تختفي من صفحة التقويم (نفترض +3 أيام من تاريخ الإنشاء).
update public.orders
set delivery_date = (created_at::date + interval '3 days')::date
where delivery_date is null;

-- فهرس لتسريع استعلامات "طلبات هذا اليوم / هذا الشهر" في صفحة التقويم
create index if not exists idx_orders_delivery_date on public.orders (delivery_date);

comment on column public.orders.delivery_date is 'تاريخ التسليم المتفق عليه مع العميل — يُستخدم لتنظيم صفحة المهام/التقويم اليومي';
