-- ══════════════════════════════════════════════════════════════════
-- نظام إعادة المحاولة التلقائي لزاتكا + تصنيف الأخطاء
-- ══════════════════════════════════════════════════════════════════

alter table orders add column if not exists zatca_retry_count int not null default 0;
alter table orders add column if not exists zatca_needs_review boolean not null default false;
alter table orders add column if not exists zatca_error_category text;

alter table sales_invoices add column if not exists zatca_retry_count int not null default 0;
alter table sales_invoices add column if not exists zatca_needs_review boolean not null default false;
alter table sales_invoices add column if not exists zatca_error_category text;

alter table zatca_submission_log add column if not exists error_category text;
alter table zatca_submission_log add column if not exists auto_fix_applied text;

create index if not exists idx_orders_zatca_pending
  on orders (zatca_status) where zatca_status in ('REJECTED', 'ERROR');
create index if not exists idx_sales_zatca_pending
  on sales_invoices (zatca_status) where zatca_status in ('REJECTED', 'ERROR');
