-- تفعيل Supabase Realtime لكل الجداول اللي البرنامج يحتاج يراقبها لحظياً.
-- بدون هذا الملف، الاشتراك بـ postgres_changes بالكود (RealtimeSync.jsx)
-- ما راح يوصله أي حدث أبداً، حتى لو الكود صحيح 100%، لأن Supabase
-- لا يبث تغييرات أي جدول إلا إذا كان مُضافاً لـ publication باسم
-- supabase_realtime.
--
-- شغّله مرة وحدة من: Supabase Dashboard → SQL Editor → New query
-- (آمن يتكرر تشغيله — يتجاوز أي جدول مُفعّل مسبقاً مثل orders)

do $$
declare
  t text;
  tables text[] := array[
    'orders','customers','employees','branches',
    'inventory_items','suppliers','supplier_products','products',
    'sales_invoices','expenses','audit_logs','app_settings',
    'loyalty_cards','loyalty_stamps','loyalty_settings',
    'loyalty_members','loyalty_points_transactions',
    'loyalty_member_notifications','loyalty_membership_settings',
    'bookings','services','reviews','working_hours',
    'brands','shop_settings','site_visits','stock_movements',
    'workshop_custodies','workshop_settlements','operations_plans',
    'workflow_stages'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
