create or replace function lock_total_price_after_creation()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and OLD.total_price is distinct from NEW.total_price then
    raise exception 'السعر الإجمالي مقفول بعد إنشاء الطلب ولا يمكن تعديله. لتصحيح خطأ، أصدر إشعار دائن/مدين.'
      using errcode = '23514';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_lock_total_price_orders on orders;
create trigger trg_lock_total_price_orders
  before update on orders
  for each row execute function lock_total_price_after_creation();
