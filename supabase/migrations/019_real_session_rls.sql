-- ══════════════════════════════════════════════════════════════════
-- 019: جلسة حقيقية موثّقة (Supabase Auth) + RLS فعلية بدل using(true)
-- ────────────────────────────────────────────────────────────────────
-- المشكلة: تسجيل الدخول (PIN) كان يتحقق بأمان على السيرفر (pos-login)،
-- لكن بعد النجاح كان يرجّع بيانات الموظف كـ JSON عادي يُخزَّن بـ localStorage
-- فقط. القاعدة نفسها ما كانت تعرف "مين المتصل فعلياً" — فسياسات RLS على
-- expenses وجداول ZATCA كانت مكتوبة using(true) (تسمح للجميع)، لأنه ما
-- كان فيه أي هوية موثّقة داخل القاعدة يمكن التحقق منها أصلاً.
--
-- الحل: كل موظف يُربط بمستخدم حقيقي في auth.users (يُنشأ تلقائياً أول
-- مرة يسجّل دخول). دالة pos-login ترجّع الآن access_token/refresh_token
-- حقيقيين من Supabase Auth، والمتصفح يستخدمهم فعلياً بكل طلب. وبذلك تقدر
-- سياسات RLS تتحقق من auth.uid() مباشرة داخل القاعدة — حتى لو حد استخدم
-- الـ anon key مباشرة من الكونسول بدون جلسة حقيقية، القاعدة ترفضه.
-- ══════════════════════════════════════════════════════════════════

-- ── ربط كل موظف بمستخدم Auth حقيقي ─────────────────────────────────
alter table employees add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists idx_employees_auth_user_id on employees(auth_user_id) where auth_user_id is not null;

-- ── دالة تُرجع دور المستخدم الحالي بناءً على جلسة Auth حقيقية فقط ──
-- security definer عشان تقدر تقرأ جدول employees حتى لو RLS يمنع anon
-- منه مباشرة؛ لكنها بحد ذاتها لا ترجع شيئاً إلا لو auth.uid() مطابق
-- فعلياً لمستخدم Auth حقيقي ومفعّل (is_active = true).
create or replace function public.current_employee_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from employees
  where auth_user_id = auth.uid() and is_active = true
  limit 1;
$$;

grant execute on function public.current_employee_role() to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════
-- expenses — كانت مفتوحة بالكامل (using(true)). الآن مقيّدة بالدور
-- الفعلي المُتحقَّق منه من القاعدة، مطابقة لنفس صلاحيات "isFinanceUser"
-- في src/lib/roles.js
-- ══════════════════════════════════════════════════════════════════
drop policy if exists "expenses_read"   on expenses;
drop policy if exists "expenses_write"  on expenses;
drop policy if exists "expenses_update" on expenses;
drop policy if exists "expenses_delete" on expenses;

create policy "expenses_read" on expenses for select
  using (current_employee_role() in ('owner','admin','manager','accountant'));
create policy "expenses_write" on expenses for insert
  with check (current_employee_role() in ('owner','admin','manager','accountant'));
create policy "expenses_update" on expenses for update
  using (current_employee_role() in ('owner','admin','manager','accountant'));
create policy "expenses_delete" on expenses for delete
  using (current_employee_role() in ('owner','admin','manager'));

-- طبقة حماية إضافية: نقطع صلاحية anon نهائياً على مستوى الجدول
-- (RLS وحدها كافية، لكن هذا يمنع حتى لو انحذفت سياسة بالغلط لاحقاً)
revoke all on expenses from anon;
grant select, insert, update, delete on expenses to authenticated;

-- ══════════════════════════════════════════════════════════════════
-- ZATCA — نفس المبدأ (بيانات ضريبية حساسة، لازم تكون بنفس التقييد)
-- ══════════════════════════════════════════════════════════════════
drop policy if exists "zatca_settings_read" on zatca_settings;
create policy "zatca_settings_read" on zatca_settings for select
  using (current_employee_role() in ('owner','admin','manager','accountant'));
revoke all on zatca_settings from anon;
grant select on zatca_settings to authenticated;

drop policy if exists "zatca_log_read" on zatca_submission_log;
create policy "zatca_log_read" on zatca_submission_log for select
  using (current_employee_role() in ('owner','admin','manager','accountant'));
revoke all on zatca_submission_log from anon;
grant select on zatca_submission_log to authenticated;
