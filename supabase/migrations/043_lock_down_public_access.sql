-- ══════════════════════════════════════════════════════════════════
-- 043 — قفل قاعدة البيانات عن الإنترنت (private)
-- ────────────────────────────────────────────────────────────────
-- ⚠️ لا تشغّله إلا بعد: (١) نشر نسخة الموقع الجديدة (بوابة /sb)، (٢) ضبط
-- SUPABASE_SERVICE_ROLE_KEY في Vercel، (٣) تجربة البرنامج كاملة وهو شغال.
-- بعده المتصفح لا يقدر يقرأ/يكتب أي جدول مباشرة بالمفتاح العام؛ كل شيء عبر
-- الخادم (service_role يتجاوز RLS ولا يتأثر).
-- التراجع: جدول _lockdown_policy_backup يحفظ كل السياسات المحذوفة (انظر آخر الملف).
-- لا يحذف أي بيانات.
-- ══════════════════════════════════════════════════════════════════

-- 0) نسخة احتياطية من كل السياسات الحالية قبل حذفها
create table if not exists public._lockdown_policy_backup as
  select now() as saved_at, schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname in ('public', 'storage') and false;
insert into public._lockdown_policy_backup
  select now(), schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname in ('public', 'storage');
revoke all on public._lockdown_policy_backup from anon, authenticated;

-- 1) سحب كل صلاحيات الجداول/التسلسلات/الدوال عن الدور العام والمسجّل
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- 2) تفعيل RLS على كل الجداول وحذف كل السياسات المفتوحة (service_role يتجاوزها)
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename <> '_lockdown_policy_backup' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename <> '_lockdown_policy_backup' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3) التخزين: لا رفع/حذف/سرد من الإنترنت (الرفع الآن عبر البوابة). قراءة الروابط العامة للصور تبقى.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- 4) الفيو العام يحترم صلاحيات المستعلم
do $$ begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'zatca_public_info') then
    execute 'alter view public.zatca_public_info set (security_invoker = on)';
  end if;
end $$;

-- 5) إيقاف بث Realtime لصفوف الجداول (التحديث صار دورياً من الخادم)
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' loop
    execute format('alter publication supabase_realtime drop table %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;

-- للتراجع الطارئ (يعيد الفتح — لا تستخدمه إلا لو تعطّل البرنامج):
--   grant select, insert, update, delete on all tables in schema public to anon;
--   وأعد السياسات من الجدول _lockdown_policy_backup.
