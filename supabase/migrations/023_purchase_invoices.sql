-- ══════════════════════════════════════════════════════════════════
-- 023 — جداول فواتير الشراء (input VAT + المستحقات للموردين)
-- ────────────────────────────────────────────────────────────────
-- src/pages/Purchasing.jsx و src/pages/TaxDashboard.jsx و
-- api/reports/export-excel.js يستخدمون جدول purchase_invoices
-- بهذا الشكل بالضبط منذ البداية (حتى رسالة الخطأ بـ Purchasing.jsx
-- تسمي ملف هجرة "016_purchasing_tax_module.sql" لم يكن موجوداً
-- أصلاً بالمستودع) — يعني وحدة ضريبة المدخلات/المشتريات بالكامل
-- كانت معطّلة فعلياً. هذا يُنشئها لو مو موجودة، بدون أي أثر لو
-- كانت موجودة أصلاً بقاعدتك (كل شي IF NOT EXISTS).
-- ══════════════════════════════════════════════════════════════════

create table if not exists purchase_invoices (
  id                            uuid primary key default gen_random_uuid(),
  supplier_id                   uuid references suppliers(id) on delete set null,
  invoice_number                text not null,
  invoice_date                  date not null default current_date,
  taxable_amount                numeric(10,2) not null default 0,
  vat_rate                      numeric(5,2) not null default 15,
  vat_amount                    numeric(10,2) not null default 0,
  tax_classification            text not null default 'raw_material',
  document_url                  text,
  notes                         text,
  supplier_vat_number_snapshot  text,
  vat_number_valid_format       boolean not null default false,
  -- كم عليك للمورد — تتبّع مستحقات الموردين (accounts payable)
  payment_status                text not null default 'unpaid' check (payment_status in ('unpaid','paid','partial')),
  amount_paid                   numeric(10,2) not null default 0,
  created_by                    text,
  created_at                    timestamptz default now()
);

create table if not exists purchase_invoice_items (
  id                    uuid primary key default gen_random_uuid(),
  purchase_invoice_id   uuid not null references purchase_invoices(id) on delete cascade,
  item_id               uuid references inventory_items(id) on delete set null,
  description           text,
  quantity              numeric(10,2) not null default 1,
  unit_cost             numeric(10,2) not null default 0,
  created_at            timestamptz default now()
);

-- الجدول purchase_invoices موجود فعلاً بقاعدة الإنتاج (بدون هذين
-- العمودين) — CREATE TABLE IF NOT EXISTS وحدها ما تضيفهم لأنها تتجاهل
-- الأمر بالكامل إذا الجدول موجود. نضيفهم صراحة هنا (آمن دائماً، إضافي
-- فقط، ما يمس أي بيانات موجودة):
alter table purchase_invoices add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','partial'));
alter table purchase_invoices add column if not exists amount_paid numeric(10,2) not null default 0;

create index if not exists idx_purchase_invoices_date on purchase_invoices(invoice_date);
create index if not exists idx_purchase_invoices_supplier on purchase_invoices(supplier_id);
create index if not exists idx_purchase_invoices_payment_status on purchase_invoices(payment_status) where payment_status != 'paid';
create index if not exists idx_purchase_invoice_items_invoice on purchase_invoice_items(purchase_invoice_id);

alter table purchase_invoices enable row level security;
alter table purchase_invoice_items enable row level security;

drop policy if exists "purchase_invoices_read" on purchase_invoices;
drop policy if exists "purchase_invoices_write" on purchase_invoices;
drop policy if exists "purchase_invoices_update" on purchase_invoices;
drop policy if exists "purchase_invoices_delete" on purchase_invoices;
create policy "purchase_invoices_read" on purchase_invoices for select
  using (current_employee_role() in ('owner','admin','manager','accountant'));
create policy "purchase_invoices_write" on purchase_invoices for insert
  with check (current_employee_role() in ('owner','admin','manager','accountant'));
create policy "purchase_invoices_update" on purchase_invoices for update
  using (current_employee_role() in ('owner','admin','manager','accountant'));
create policy "purchase_invoices_delete" on purchase_invoices for delete
  using (current_employee_role() in ('owner','admin','manager'));
revoke all on purchase_invoices from anon;
grant select, insert, update, delete on purchase_invoices to authenticated;

drop policy if exists "purchase_invoice_items_all" on purchase_invoice_items;
create policy "purchase_invoice_items_all" on purchase_invoice_items for all
  using (current_employee_role() in ('owner','admin','manager','accountant'))
  with check (current_employee_role() in ('owner','admin','manager','accountant'));
revoke all on purchase_invoice_items from anon;
grant select, insert, update, delete on purchase_invoice_items to authenticated;
