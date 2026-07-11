-- ══════════════════════════════════════════════════════════════
-- 006: تأمين تسجيل الدخول لصفحة الـ POS
-- - محاولات الدخول تُحسب وتُقيَّد على مستوى الـ IP (سيرفر، لا يمكن تجاوزها بمسح المتصفح)
-- - منع أي وصول مباشر من المتصفح لعمود الـ PIN (يمر فقط عبر edge function بصلاحية service role)
-- ══════════════════════════════════════════════════════════════

-- ── جدول محاولات الدخول حسب الـ IP ─────────────────────────────
create table if not exists public.login_attempts (
  ip           text primary key,
  attempts     integer     not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

-- لا صلاحيات على الإطلاق من المتصفح (anon/authenticated) — الوصول فقط عبر service role داخل الـ edge function
revoke all on public.login_attempts from anon, authenticated;

-- تنظيف دوري للسجلات القديمة (اختياري، يمكن جدولته مثل باقي الدوال المجدولة في الملف 005)
create or replace function public.cleanup_old_login_attempts()
returns void
language sql
security definer
as $$
  delete from public.login_attempts
  where updated_at < now() - interval '7 days';
$$;

-- ── تقييد الوصول لعمود الـ PIN في جدول الموظفين ─────────────────
-- بدلاً من select('*') من المتصفح (كان يفضح كل أرقام الـ PIN لأي زائر لصفحة /login),
-- نمنع anon من قراءة عمود pin نهائياً على مستوى العمود، ونسمح فقط بالأعمدة غير الحساسة.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'employees') then
    revoke select on public.employees from anon;
    -- عدّل قائمة الأعمدة هنا لتطابق مخطط جدولك الفعلي إن اختلف
    grant select (id, name, role, avatar_url, is_active, created_at) on public.employees to anon;
  end if;
end $$;
