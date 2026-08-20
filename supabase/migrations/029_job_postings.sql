-- خانة الوظائف: يديرها المالك/المدير من لوحة الإدارة (نفس الجهاز
-- المستخدم بالـ POS)، وتظهر بصفحة عامة قابلة للفهرسة بجوجل لكل وظيفة
-- برابط مستقل (لازم لظهورها بنتائج البحث بشكل صحيح).
-- ملاحظة: طُبّقت فعلياً على قاعدة الإنتاج باسم "028_job_postings"
-- (نسختها هنا بترقيم 029 تجنباً لتعارض التسمية مع 028_b2b_invoicing_toggle
-- اللي أُضيفت بجلسة موازية بنفس الرقم — القيمة الفعلية بقاعدة البيانات
-- مسجّلة بترتيب زمني صحيح ولا يوجد أي تعارض حقيقي).

create table if not exists job_postings (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text not null unique,
  department        text,
  employment_type   text not null default 'full_time'
                       check (employment_type in ('full_time','part_time','contract')),
  location          text,
  description       text,
  requirements      text,
  salary_note       text,
  apply_method      text not null default 'whatsapp'
                       check (apply_method in ('email','whatsapp','phone','link')),
  apply_value       text not null,
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_job_postings_active on job_postings(is_active, sort_order);
create index if not exists idx_job_postings_slug on job_postings(slug);

alter table job_postings enable row level security;

drop policy if exists "job_postings_read" on job_postings;
create policy "job_postings_read" on job_postings for select
  using (is_active = true or current_employee_role() is not null);

drop policy if exists "job_postings_write" on job_postings;
create policy "job_postings_write" on job_postings for insert
  with check (current_employee_role() in ('owner','admin','manager'));

drop policy if exists "job_postings_update" on job_postings;
create policy "job_postings_update" on job_postings for update
  using (current_employee_role() in ('owner','admin','manager'));

drop policy if exists "job_postings_delete" on job_postings;
create policy "job_postings_delete" on job_postings for delete
  using (current_employee_role() in ('owner','admin'));

grant select on job_postings to anon;
grant select, insert, update, delete on job_postings to authenticated;

create or replace function job_postings_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_job_postings_updated_at on job_postings;
create trigger trg_job_postings_updated_at
  before update on job_postings
  for each row execute function job_postings_set_updated_at();
