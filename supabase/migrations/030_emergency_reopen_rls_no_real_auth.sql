-- عطل طارئ 2026-08: تشديد RLS بميغريشن 026 (وبعض أجزاء 023/028/029)
-- افترض إن تسجيل الدخول يعطي جلسة Supabase Auth حقيقية (auth.uid()).
-- فعلياً نظام الدخول بالتطبيق مبني بالكامل على PIN محفوظ بـ localStorage
-- بدون أي جلسة Supabase — auth.uid() يفضل فارغ دائماً، فـ
-- current_employee_role() يرجع NULL دائماً، وهذا قفل كل الصفحات
-- (الطلبات/الفواتير/الحجوزات/الأرباح/المصاريف) للجميع بما فيهم الموظفين.
--
-- هذا إصلاح طارئ لاستعادة الخدمة فوراً: يرجّع القراءة/الكتابة مفتوحة
-- على الجداول المتأثرة (نفس وضعها الأصلي قبل ميغريشن 026)، لحين ما
-- يُبنى ربط حقيقي بين نظام تسجيل الدخول الحالي وجلسة Supabase Auth
-- (أو تحويل هالاستعلامات لمسارات سيرفر محمية زي /api/secure).
--
-- ملاحظة أمانة: هذا يرجّع فتح نفس الثغرة اللي كانت ميغريشن 026 تسكرها
-- (أي حد يعرف anon key يوصل البيانات مباشرة) كحل مؤقت لإيقاف تعطّل
-- التطبيق الحي بالكامل. يحتاج معالجة جذرية لاحقاً (ليست جزء من هذا
-- الإصلاح الطارئ).

drop policy if exists "orders_read" on orders;
create policy "orders_read" on orders for select using (true);
drop policy if exists "orders_write" on orders;
create policy "orders_write" on orders for insert with check (true);
drop policy if exists "orders_update" on orders;
create policy "orders_update" on orders for update using (true);
drop policy if exists "orders_delete" on orders;
create policy "orders_delete" on orders for delete using (true);
grant select, insert, update, delete on orders to anon;

drop policy if exists "sales_invoices_read" on sales_invoices;
create policy "sales_invoices_read" on sales_invoices for select using (true);
drop policy if exists "sales_invoices_write" on sales_invoices;
create policy "sales_invoices_write" on sales_invoices for insert with check (true);
drop policy if exists "sales_invoices_update" on sales_invoices;
create policy "sales_invoices_update" on sales_invoices for update using (true);
drop policy if exists "sales_invoices_delete" on sales_invoices;
create policy "sales_invoices_delete" on sales_invoices for delete using (true);
grant select, insert, update, delete on sales_invoices to anon;

drop policy if exists "customers_read" on customers;
create policy "customers_read" on customers for select using (true);
drop policy if exists "customers_write" on customers;
create policy "customers_write" on customers for insert with check (true);
drop policy if exists "customers_update" on customers;
create policy "customers_update" on customers for update using (true);
drop policy if exists "customers_delete" on customers;
create policy "customers_delete" on customers for delete using (true);
grant select, insert, update, delete on customers to anon;

drop policy if exists "suppliers_read" on suppliers;
create policy "suppliers_read" on suppliers for select using (true);
drop policy if exists "suppliers_write" on suppliers;
create policy "suppliers_write" on suppliers for all using (true) with check (true);
grant select, insert, update, delete on suppliers to anon;

drop policy if exists "supplier_products_all" on supplier_products;
create policy "supplier_products_read" on supplier_products for select using (true);
create policy "supplier_products_write2" on supplier_products for insert with check (true);
create policy "supplier_products_update2" on supplier_products for update using (true);
grant select, insert, update, delete on supplier_products to anon;

drop policy if exists "purchase_invoices_read" on purchase_invoices;
create policy "purchase_invoices_read" on purchase_invoices for select using (true);
drop policy if exists "purchase_invoices_write" on purchase_invoices;
create policy "purchase_invoices_write" on purchase_invoices for insert with check (true);
drop policy if exists "purchase_invoices_update" on purchase_invoices;
create policy "purchase_invoices_update" on purchase_invoices for update using (true);
drop policy if exists "purchase_invoices_delete" on purchase_invoices;
create policy "purchase_invoices_delete2" on purchase_invoices for delete using (true);
grant select, insert, update, delete on purchase_invoices to anon;

drop policy if exists "purchase_invoice_items_all" on purchase_invoice_items;
create policy "purchase_invoice_items_all2" on purchase_invoice_items for all using (true) with check (true);
grant select, insert, update, delete on purchase_invoice_items to anon;

drop policy if exists "job_postings_read" on job_postings;
create policy "job_postings_read2" on job_postings for select using (true);
drop policy if exists "job_postings_write" on job_postings;
create policy "job_postings_write2" on job_postings for insert with check (true);
drop policy if exists "job_postings_update" on job_postings;
create policy "job_postings_update2" on job_postings for update using (true);
drop policy if exists "job_postings_delete" on job_postings;
create policy "job_postings_delete2" on job_postings for delete using (true);

drop policy if exists "zatca_notes_read" on zatca_credit_debit_notes;
create policy "zatca_notes_read2" on zatca_credit_debit_notes for select using (true);
grant select, insert on zatca_credit_debit_notes to anon;

grant execute on function get_monthly_financial_trend(int) to anon;

-- expenses: هذا كان معطّلاً من قبل اليوم أصلاً (RLS بدون أي وصول
-- فعلي لـ current_employee_role) — زر "إضافة مصروف" ما كان يشتغل إطلاقاً
drop policy if exists "expenses_read" on expenses;
create policy "expenses_read2" on expenses for select using (true);
drop policy if exists "expenses_write" on expenses;
create policy "expenses_write2" on expenses for insert with check (true);
drop policy if exists "expenses_update" on expenses;
create policy "expenses_update2" on expenses for update using (true);
drop policy if exists "expenses_delete" on expenses;
create policy "expenses_delete2" on expenses for delete using (true);
grant select, insert, update, delete on expenses to anon;
