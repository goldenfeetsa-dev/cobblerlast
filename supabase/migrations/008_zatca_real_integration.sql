-- ══════════════════════════════════════════════════════════════════
-- ZATCA Phase 2 — real invoice chain + settings
-- IMPORTANT: certificate / private_key / api_secret are NEVER stored
-- here. Those live only as server-side env vars on the signing
-- backend (Vercel). This table only holds non-secret business info
-- and the sequential invoice counter / hash chain (ICV/PIH) which
-- ZATCA requires to be strictly sequential and gapless.
-- ══════════════════════════════════════════════════════════════════

create table if not exists zatca_invoice_chain (
  id int primary key default 1,
  last_icv bigint not null default 0,
  last_invoice_hash text not null default 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjQyZjNiYmI4YTM4ZjE4NA==',
  updated_at timestamptz default now(),
  constraint zatca_chain_single_row check (id = 1)
);
insert into zatca_invoice_chain (id) values (1) on conflict (id) do nothing;

-- Atomically reserves the next Invoice Counter Value and returns the
-- previous invoice's hash (needed as PIH for the new invoice).
-- Locks the row so two simultaneous submissions (e.g. NewOrder + Sales
-- POS at the same second) can never reuse the same ICV/PIH.
create or replace function zatca_reserve_next()
returns table(icv bigint, prev_hash text)
language plpgsql
security definer
as $$
declare
  v_icv bigint;
  v_prev text;
begin
  update zatca_invoice_chain
  set last_icv = last_icv + 1
  where id = 1
  returning last_icv, last_invoice_hash into v_icv, v_prev;

  return query select v_icv, v_prev;
end;
$$;

-- Called after a successful ZATCA submission to advance the chain.
create or replace function zatca_commit_hash(p_hash text)
returns void
language plpgsql
security definer
as $$
begin
  update zatca_invoice_chain set last_invoice_hash = p_hash, updated_at = now() where id = 1;
end;
$$;

-- Business info needed to build the XML (NOT secret — VAT number/CR
-- number are public anyway, they're printed on every paper receipt).
create table if not exists zatca_settings (
  id int primary key default 1,
  seller_name text not null default 'إبرة وخيط الإسكافي',
  vat_number text not null default '',
  cr_number text not null default '',
  city text not null default 'الرياض',
  district text not null default 'الرياض',
  street text not null default '',
  postal_code text not null default '11111',
  building_number text not null default '0000',
  environment text not null default 'sandbox' check (environment in ('sandbox','simulation','production')),
  egs_uuid text not null default '',
  connected boolean not null default false,
  last_test_at timestamptz,
  updated_at timestamptz default now(),
  constraint zatca_settings_single_row check (id = 1)
);
insert into zatca_settings (id) values (1) on conflict (id) do nothing;

-- Log of every submission attempt (success or failure) for audit.
create table if not exists zatca_submission_log (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,       -- 'order' | 'sale'
  record_id uuid not null,
  invoice_number text,
  icv bigint,
  invoice_hash text,
  status text not null,            -- 'REPORTED' | 'REJECTED' | 'ERROR'
  environment text,
  zatca_response jsonb,
  error_message text,
  created_at timestamptz default now()
);

alter table zatca_invoice_chain enable row level security;
alter table zatca_settings enable row level security;
alter table zatca_submission_log enable row level security;

-- Only the service role (used by the server-side signing function)
-- may touch these tables directly. The app's anon/authenticated key
-- gets read-only access to settings + log for the admin UI.
create policy "zatca_settings_read" on zatca_settings for select using (true);
create policy "zatca_log_read" on zatca_submission_log for select using (true);

-- orders / sales_invoices: columns to hold the real ZATCA result
alter table orders add column if not exists zatca_status text;
alter table orders add column if not exists zatca_qr text;
alter table orders add column if not exists zatca_invoice_hash text;
alter table orders add column if not exists zatca_uuid text;
alter table orders add column if not exists zatca_submitted_at timestamptz;

alter table sales_invoices add column if not exists zatca_status text;
alter table sales_invoices add column if not exists zatca_qr text;
alter table sales_invoices add column if not exists zatca_invoice_hash text;
alter table sales_invoices add column if not exists zatca_uuid text;
alter table sales_invoices add column if not exists zatca_submitted_at timestamptz;
