-- ══════════════════════════════════════════════════════════════════
-- Fix: FinancialReports.jsx (expense entry form) and TaxDashboard.jsx
-- (VAT return) already read/write expenses.vat_amount and
-- expenses.is_vat_applicable — but no migration ever created these
-- columns, so input-VAT on expenses could never actually be saved or
-- included in the tax return. This adds them.
--
-- Per ZATCA rules: input VAT on an expense is only deductible when
-- backed by a valid tax invoice showing the supplier's VAT number —
-- that's why supplier_vat_number / has_tax_invoice are also added,
-- or you'd not be able to prove the deduction later.
-- ══════════════════════════════════════════════════════════════════

alter table expenses add column if not exists vat_amount numeric not null default 0 check (vat_amount >= 0);
alter table expenses add column if not exists subtotal numeric;
alter table expenses add column if not exists is_vat_applicable boolean not null default false;
alter table expenses add column if not exists supplier_vat_number text;
alter table expenses add column if not exists has_tax_invoice boolean not null default false;

create index if not exists idx_expenses_vat_applicable on expenses (is_vat_applicable) where is_vat_applicable = true;
