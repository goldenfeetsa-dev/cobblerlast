-- 039 — منع تعطيل ضريبة القيمة المضافة (إلزامية نظامياً): تثبيت vat_enabled = true على مستوى القاعدة.
-- آمن للتكرار ولا يحذف بيانات.
update public.app_settings set vat_enabled = true where vat_enabled is distinct from true;

create or replace function public.app_settings_force_vat()
returns trigger language plpgsql as $$
begin
  NEW.vat_enabled := true;
  return NEW;
end $$;

drop trigger if exists trg_app_settings_force_vat on public.app_settings;
create trigger trg_app_settings_force_vat
  before insert or update on public.app_settings
  for each row execute function public.app_settings_force_vat();
