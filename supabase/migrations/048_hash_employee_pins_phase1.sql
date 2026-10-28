-- Applied via MCP. Hash-on-write for employees.pin (bcrypt cost 11) + login RPC (accepts legacy plaintext until phase 2).
-- Phase 2 (run ONLY after the new /api/auth/login is live and a login succeeded):
--   update public.employees set pin = pin where pin !~ '^\$2[aby]\$';
create or replace function public.employees_hash_pin() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.pin is null or new.pin = '' then return new; end if;
  if new.pin ~ '^\$2[aby]\$' then return new; end if;
  if new.pin !~ '^[0-9]{4,8}$' then raise exception 'pin_invalid'; end if;
  if exists (select 1 from public.employees e where e.id is distinct from new.id and e.is_active
             and ((e.pin ~ '^\$2[aby]\$' and e.pin = crypt(new.pin, e.pin)) or e.pin = new.pin)) then raise exception 'pin_in_use'; end if;
  new.pin := crypt(new.pin, gen_salt('bf', 11));
  return new;
end $$;
create trigger trg_employees_hash_pin before insert or update of pin on public.employees for each row execute function public.employees_hash_pin();
-- employee_login_by_pin(p_pin) : service_role only (see MCP migration for body)
