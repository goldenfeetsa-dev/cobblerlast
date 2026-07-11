create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null default 'other', -- rent | salaries | utilities | supplies | maintenance | marketing | other
  description text,
  amount numeric not null check (amount >= 0),
  created_by text,
  created_at timestamptz default now()
);

alter table expenses enable row level security;
create policy "expenses_read" on expenses for select using (true);
create policy "expenses_write" on expenses for insert with check (true);
create policy "expenses_update" on expenses for update using (true);
create policy "expenses_delete" on expenses for delete using (true);

create index if not exists idx_expenses_date on expenses (expense_date);
