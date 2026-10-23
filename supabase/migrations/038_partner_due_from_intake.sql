-- 038 — موعد سداد الشركات يُحسب من تاريخ استلام الطلب (دخول الشنطة للورشة) + مدة السداد (15 يوم)
-- بدل تاريخ التسليم. آمن للتكرار، لا يحذف بيانات.

create or replace function public.partner_order_delivery_stamp()
returns trigger language plpgsql as $$
declare v_terms integer;
begin
  if NEW.partner_id is null then return NEW; end if;

  -- موعد السداد: تاريخ استلام الطلب (بتوقيت الرياض) + أيام السداد، يُحدد عند الإنشاء
  if NEW.payment_due_date is null then
    select payment_terms_days into v_terms from public.partners where id = NEW.partner_id;
    NEW.payment_due_date :=
      (coalesce(NEW.created_at, now()) at time zone 'Asia/Riyadh')::date + coalesce(v_terms, 15);
  end if;

  -- ختم التسليم الفعلي فقط (لا يؤثر على موعد السداد)
  if NEW.status = 'completed' and NEW.delivered_at is null
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'completed') then
    NEW.delivered_at := now();
  end if;
  return NEW;
end $$;

-- تصحيح الطلبات الموجودة (إن وُجدت): الاستحقاق من تاريخ الاستلام
update public.orders o
   set payment_due_date = (o.created_at at time zone 'Asia/Riyadh')::date + p.payment_terms_days
  from public.partners p
 where o.partner_id = p.id and o.payment_status = 'unpaid' and o.partner_invoice_id is null;

-- قائمة الشركات: المستحق = غير مسدّد ومسعّر وحلّ موعد سداده (بصرف النظر عن التسليم)،
-- والقريب = يستحق خلال يومين
create or replace function public.partner_admin_list()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id, 'name', p.name, 'is_active', p.is_active,
      'vat_number', p.vat_number, 'cr_number', p.cr_number, 'phone', p.phone,
      'created_at', p.created_at,
      'open',  count(o.id) filter (where o.status in ('pending','in_progress','ready')),
      'total', count(o.id) filter (where o.status <> 'cancelled'),
      'unpaid_total', coalesce(sum(o.total_price) filter (
          where o.payment_status = 'unpaid' and o.status <> 'cancelled' and o.total_price > 0), 0),
      'due_count', count(o.id) filter (
          where o.payment_status = 'unpaid' and o.status <> 'cancelled' and o.total_price > 0
            and o.payment_due_date <= (now() at time zone 'Asia/Riyadh')::date),
      'due_total', coalesce(sum(o.total_price) filter (
          where o.payment_status = 'unpaid' and o.status <> 'cancelled' and o.total_price > 0
            and o.payment_due_date <= (now() at time zone 'Asia/Riyadh')::date), 0),
      'soon_count', count(o.id) filter (
          where o.payment_status = 'unpaid' and o.status <> 'cancelled' and o.total_price > 0
            and o.payment_due_date >  (now() at time zone 'Asia/Riyadh')::date
            and o.payment_due_date <= (now() at time zone 'Asia/Riyadh')::date + 2),
      'soon_total', coalesce(sum(o.total_price) filter (
          where o.payment_status = 'unpaid' and o.status <> 'cancelled' and o.total_price > 0
            and o.payment_due_date >  (now() at time zone 'Asia/Riyadh')::date
            and o.payment_due_date <= (now() at time zone 'Asia/Riyadh')::date + 2), 0)
    ) as x
    from public.partners p
    left join public.orders o on o.partner_id = p.id
    group by p.id
  ) s;
$$;
