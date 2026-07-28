-- ══════════════════════════════════════════════════════════════════
-- ZATCA Phase 1 compliance: invoice immutability (no edit/delete
-- after reporting). Enforced with a DB trigger, not just UI checks,
-- so no client (POS, admin panel, direct API call) can bypass it.
--
-- Rule: once orders.zatca_status / sales_invoices.zatca_status =
-- 'REPORTED' (or 'CLEARED'), the row can never be deleted, and only
-- a small allowlist of purely operational columns may still change
-- (delivery/workflow status, notes, timestamps) — never anything
-- that affects the invoice's financial content. Corrections must go
-- through a credit/debit note instead.
-- ══════════════════════════════════════════════════════════════════

-- Columns allowed to change on an already-reported invoice. Add to
-- this list only for genuinely non-financial, non-invoice fields.
create or replace function zatca_is_protected_field_change(
  p_old jsonb, p_new jsonb, p_allowed_cols text[]
) returns boolean
language plpgsql
immutable
as $$
declare
  k text;
begin
  for k in select jsonb_object_keys(p_old) loop
    if k = any(p_allowed_cols) then
      continue;
    end if;
    if p_old -> k is distinct from p_new -> k then
      return true; -- a non-allowed field changed
    end if;
  end loop;
  return false;
end;
$$;

create or replace function zatca_protect_reported_invoice()
returns trigger
language plpgsql
as $$
declare
  v_allowed text[] := array[
    'status', 'payment_status', 'notes', 'internal_notes',
    'delivery_date', 'delivered_at', 'updated_at',
    'zatca_status', 'zatca_qr', 'zatca_invoice_hash', 'zatca_uuid',
    'zatca_submitted_at', 'zatca_retry_count', 'zatca_error_category',
    'zatca_needs_review'
  ];
begin
  if TG_OP = 'DELETE' then
    if OLD.zatca_status in ('REPORTED', 'CLEARED') then
      raise exception 'لا يمكن حذف فاتورة تم اعتمادها وإرسالها لهيئة الزكاة والضريبة (رقم %). لتصحيح خطأ، أصدر إشعار دائن/مدين مرتبط بها.', coalesce(OLD.order_number, OLD.invoice_number, OLD.id::text)
        using errcode = '23514';
    end if;
    return OLD;
  end if;

  if TG_OP = 'UPDATE' and OLD.zatca_status in ('REPORTED', 'CLEARED') then
    if zatca_is_protected_field_change(to_jsonb(OLD), to_jsonb(NEW), v_allowed) then
      raise exception 'هذه الفاتورة معتمدة ومُبلَّغة لزاتكا (رقم %) — سجلها للقراءة فقط ولا يجوز تعديل بياناتها المالية. أصدر إشعار دائن/مدين بدلاً من التعديل.', coalesce(OLD.order_number, OLD.invoice_number, OLD.id::text)
        using errcode = '23514';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_zatca_protect_orders on orders;
create trigger trg_zatca_protect_orders
  before update or delete on orders
  for each row execute function zatca_protect_reported_invoice();

drop trigger if exists trg_zatca_protect_sales_invoices on sales_invoices;
create trigger trg_zatca_protect_sales_invoices
  before update or delete on sales_invoices
  for each row execute function zatca_protect_reported_invoice();

-- ── Credit / Debit notes ────────────────────────────────────────
-- The only legitimate way to correct a reported invoice. Each note
-- reserves its own ICV/PIH from the same chain (zatca_reserve_next),
-- so it is itself a real, sequential, hash-chained ZATCA document —
-- not a silent edit of the original.
create table if not exists zatca_credit_debit_notes (
  id uuid primary key default gen_random_uuid(),
  note_type text not null check (note_type in ('credit', 'debit')),
  original_record_type text not null check (original_record_type in ('order', 'sale')),
  original_record_id uuid not null,
  note_number text not null unique,
  reason text not null,
  amount numeric(10,2) not null,
  vat_amount numeric(10,2) not null,
  icv bigint,
  invoice_hash text,
  zatca_status text default 'PENDING',
  zatca_qr text,
  zatca_uuid text,
  zatca_submitted_at timestamptz,
  created_by uuid,
  created_at timestamptz default now()
);

alter table zatca_credit_debit_notes enable row level security;
create policy "zatca_notes_read" on zatca_credit_debit_notes for select
  using (current_employee_role() in ('owner','admin','manager','accountant'));
revoke all on zatca_credit_debit_notes from anon;
grant select on zatca_credit_debit_notes to authenticated;
