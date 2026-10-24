-- توقيت عمل الفني: بداية العمل ← تم الإنجاز + اسم الفني (آمن للتشغيل أكثر من مرة)
alter table public.orders add column if not exists work_started_at timestamptz;
alter table public.orders add column if not exists work_done_at    timestamptz;
alter table public.orders add column if not exists worker_id       uuid;
alter table public.orders add column if not exists worker_name     text;

create or replace function public.orders_work_timing() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- إعادة فتح طلب منجز: نصفّر وقت الإنجاز ليُحسب من جديد
    if new.status in ('pending', 'in_progress') and old.status in ('ready', 'completed') then
      new.work_done_at := null;
    end if;
    if new.status = 'in_progress' and new.work_started_at is null then new.work_started_at := now(); end if;
    if new.status = 'ready' and new.work_done_at is null then
      new.work_done_at := now();
      -- انتقال مباشر لجاهز بدون بدء: نعتبر البدء الآن كي لا يبقى المدّة فارغة
      if new.work_started_at is null then new.work_started_at := now(); end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_work_timing on public.orders;
create trigger orders_work_timing before update on public.orders
  for each row execute function public.orders_work_timing();

create index if not exists orders_work_done_idx on public.orders (work_done_at desc) where work_done_at is not null;
