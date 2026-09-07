-- قفل جدول customers عن anon/authenticated مباشرة — الوصول الوحيد
-- المسموح الحين هو عبر /api/secure/data?resource=customers (يتحقق
-- من جلسة الموظف الموقّعة بالسيرفر قبل أي عملية).
drop policy if exists "customers_read" on customers;
drop policy if exists "customers_write" on customers;
drop policy if exists "customers_update" on customers;
drop policy if exists "customers_delete" on customers;
create policy "customers_deny_anon" on customers for all using (false) with check (false);
revoke all on customers from anon;
revoke all on customers from authenticated;
