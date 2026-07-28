-- ══════════════════════════════════════════════════════════════════
-- 026 — إغلاق أكبر ثغرة أمنية/محاسبية بالنظام: orders و sales_invoices
-- و customers كانت USING (true) منذ 014، ولم تُشملها 019 (اللي صححت
-- فقط expenses و zatca_settings/log). يعني أي حد يعرف الـ anon key
-- العام (موجود دايماً بكود أي تطبيق ويب من جهة العميل ويمكن قراءته
-- بسهولة من أدوات المتصفح) يقدر يقرأ/يعدّل/يحذف كل طلب وفاتورة
-- وبيانات عميل مباشرة عبر REST API، بدون المرور بالتطبيق أو تسجيل
-- الدخول إطلاقاً — بما فيها الفواتير الضريبية المُبلَّغة لزاتكا.
--
-- الحل: نفس نمط current_employee_role() من 019. القراءة/الإضافة/
-- التعديل لأي موظف مسجّل دخول فعلياً (كل الأدوار تحتاج تتعامل مع
-- الطلبات يومياً)، والحذف محصور بالإدارة الكاملة فقط — مطابق تماماً
-- لما تفرضه الواجهة أصلاً (isFullAdmin) لكن الآن مفروض بقاعدة
-- البيانات نفسها، مو بس بالواجهة.
-- ══════════════════════════════════════════════════════════════════

-- ملاحظة إضافية: بقاعدة الإنتاج كان فيه أيضاً policy ثانية اسمها
-- "allow_all_service" (USING true) على orders/customers/sales_invoices
-- بجانب "service_all_*" — لو ما حذفناها، الثغرة تبقى مفتوحة فعلياً
-- رغم كل ما يلي، لأن Postgres يجمع كل الـ permissive policies بـ OR.
drop policy if exists "allow_all_service" on orders;
drop policy if exists "service_all_orders" on orders;
create policy "orders_read" on orders for select
  using (current_employee_role() is not null);
create policy "orders_write" on orders for insert
  with check (current_employee_role() is not null);
create policy "orders_update" on orders for update
  using (current_employee_role() is not null);
create policy "orders_delete" on orders for delete
  using (current_employee_role() in ('owner','admin','manager'));
revoke all on orders from anon;
grant select, insert, update, delete on orders to authenticated;

drop policy if exists "allow_all_service" on sales_invoices;
drop policy if exists "service_all_sales_invoices" on sales_invoices;
create policy "sales_invoices_read" on sales_invoices for select
  using (current_employee_role() is not null);
create policy "sales_invoices_write" on sales_invoices for insert
  with check (current_employee_role() is not null);
create policy "sales_invoices_update" on sales_invoices for update
  using (current_employee_role() in ('owner','admin','manager','accountant'));
create policy "sales_invoices_delete" on sales_invoices for delete
  using (current_employee_role() in ('owner','admin','manager'));
revoke all on sales_invoices from anon;
grant select, insert, update, delete on sales_invoices to authenticated;

drop policy if exists "allow_all_service" on customers;
drop policy if exists "service_all_customers" on customers;
create policy "customers_read" on customers for select
  using (current_employee_role() is not null);
create policy "customers_write" on customers for insert
  with check (current_employee_role() is not null);
create policy "customers_update" on customers for update
  using (current_employee_role() is not null);
create policy "customers_delete" on customers for delete
  using (current_employee_role() in ('owner','admin','manager'));
revoke all on customers from anon;
grant select, insert, update, delete on customers to authenticated;

-- suppliers/supplier_products (012) كانت برضو USING (true) — بيانات
-- الموردين وأسعار الشراء تدخل ضمن "له علاقة بالحساب" فعلاً
drop policy if exists "service_all_suppliers" on suppliers;
create policy "suppliers_read" on suppliers for select
  using (current_employee_role() is not null);
create policy "suppliers_write" on suppliers for all
  using (current_employee_role() in ('owner','admin','manager','accountant'))
  with check (current_employee_role() in ('owner','admin','manager','accountant'));
revoke all on suppliers from anon;
grant select, insert, update, delete on suppliers to authenticated;

drop policy if exists "service_all_supplier_products" on supplier_products;
create policy "supplier_products_all" on supplier_products for all
  using (current_employee_role() is not null)
  with check (current_employee_role() is not null);
revoke all on supplier_products from anon;
grant select, insert, update, delete on supplier_products to authenticated;
