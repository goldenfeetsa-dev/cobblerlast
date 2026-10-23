-- ══════════════════════════════════════════════════════════════════
-- 037 — نظام حسابات الشركات الشريكة (B2B): أسعار ثابتة + فوترة مجمّعة
-- ══════════════════════════════════════════════════════════════════
-- يُصلح أيضاً خلل "إنشاء شركة": الكود (api/secure/data.js + PartnerPortal)
-- كان يستدعي جدول partners ودوال partner_* غير موجودة بالقاعدة الحية.
-- آمن بالكامل: IF NOT EXISTS / CREATE OR REPLACE، ولا يحذف أي بيانات.
--
-- الفكرة:
--  • كل شركة لها رمز دخول (يُخزَّن مُجزّأ SHA-256، يظهر مرة واحدة فقط).
--  • كتالوج خدمات بأسعار أساسية (يعدّلها المدير فقط) + سعر خاص لكل شركة.
--  • كل شنطة = طلب مستقل (باركود مستقل)، موعد تسليمها = اليوم + 10 أيام.
--  • السداد بعد الاستلام بـ 15 يوم (قابلة للتعديل لكل شركة).
--  • السداد = فاتورة ضريبية واحدة مجمّعة (sales_invoices) لعدة شنط؛
--    طلبات الشركات نفسها لا تُبلَّغ فرادى لزاتكا (تفادياً لتكرار الضريبة).

-- ─── 1) الجداول ─────────────────────────────────────────────────────
create table if not exists public.partners (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  code_hash          text not null unique,
  is_active          boolean not null default true,
  vat_number         text,
  cr_number          text,
  address            text,
  phone              text,
  payment_terms_days integer not null default 15 check (payment_terms_days between 0 and 365),
  turnaround_days    integer not null default 10 check (turnaround_days between 0 and 365),
  created_at         timestamptz not null default now()
);

create table if not exists public.partner_services (
  id         uuid primary key default gen_random_uuid(),
  name_ar    text not null unique,
  base_price numeric(10,2) not null default 0 check (base_price >= 0),
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.partner_prices (
  partner_id uuid not null references public.partners(id) on delete cascade,
  service_id uuid not null references public.partner_services(id) on delete cascade,
  price      numeric(10,2) not null check (price >= 0),
  primary key (partner_id, service_id)
);

-- لا سياسات = لا وصول مباشر من المتصفح. الوصول فقط عبر دوال SECURITY DEFINER
-- و service_role (من api/secure/data.js بعد التحقق من الجلسة والدور).
alter table public.partners         enable row level security;
alter table public.partner_services enable row level security;
alter table public.partner_prices   enable row level security;
revoke all on public.partners, public.partner_services, public.partner_prices from anon, authenticated;

-- أسعار الخدمات تبدأ 0 عمداً: المدير يحدد الأسعار، والنظام يرفض إنشاء
-- شنطة بخدمة سعرها 0 (حتى ما تنطلع شنطة بسعر صفر بالغلط).
insert into public.partner_services (name_ar, base_price, sort_order) values
  ('تصليح عجلات الحقيبة', 0, 1),
  ('تصليح الهاندل',       0, 2),
  ('تصليح نصف سحاب',      0, 3),
  ('تصليح سحاب كامل',     0, 4),
  ('تصليح قاعدة الشنطة',  0, 5)
on conflict (name_ar) do nothing;

-- ─── 2) أعمدة الطلبات ───────────────────────────────────────────────
alter table public.orders add column if not exists delivered_at        timestamptz;
alter table public.orders add column if not exists payment_due_date    date;
alter table public.orders add column if not exists partner_invoice_id  uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_partner_id_fkey') then
    alter table public.orders add constraint orders_partner_id_fkey
      foreign key (partner_id) references public.partners(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_partner_invoice_id_fkey') then
    alter table public.orders add constraint orders_partner_invoice_id_fkey
      foreign key (partner_invoice_id) references public.sales_invoices(id);
  end if;
end $$;

create index if not exists idx_orders_partner         on public.orders(partner_id) where partner_id is not null;
create index if not exists idx_orders_partner_invoice on public.orders(partner_invoice_id) where partner_invoice_id is not null;

-- ─── 3) ختم تاريخ الاستلام وموعد السداد عند تسليم طلب شركة ──────────
create or replace function public.partner_order_delivery_stamp()
returns trigger language plpgsql as $$
declare v_terms integer;
begin
  if NEW.partner_id is not null
     and NEW.status = 'completed'
     and NEW.delivered_at is null
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'completed') then
    select payment_terms_days into v_terms from public.partners where id = NEW.partner_id;
    NEW.delivered_at     := now();
    NEW.payment_due_date := (now() at time zone 'Asia/Riyadh')::date + coalesce(v_terms, 15);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_partner_delivery_stamp on public.orders;
create trigger trg_partner_delivery_stamp
  before insert or update on public.orders
  for each row execute function public.partner_order_delivery_stamp();

-- قفل السعر (033) يبقى كما هو، مع استثناء ضيق جداً: دالة تسعير الشركات
-- (SECURITY DEFINER) فقط، وفقط لطلب شركة لم يُفوتَر بعد. المتصفح ما يقدر
-- يضبط هذا المتغير (ما فيه دالة set_config معروضة عبر PostgREST).
create or replace function public.lock_total_price_after_creation()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and OLD.total_price is distinct from NEW.total_price then
    if current_setting('app.partner_pricing', true) = '1'
       and OLD.partner_id is not null
       and OLD.partner_invoice_id is null
       and OLD.zatca_status is distinct from 'REPORTED' then
      return NEW;
    end if;
    raise exception 'السعر الإجمالي مقفول بعد إنشاء الطلب ولا يمكن تعديله. لتصحيح خطأ، أصدر إشعار دائن/مدين.'
      using errcode = '23514';
  end if;
  return NEW;
end $$;

-- ─── 4) دوال مساعدة ─────────────────────────────────────────────────
-- تسعير خدمات شنطة: سعر الشركة الخاص إن وُجد، وإلا السعر الأساسي. السعر دائماً
-- يُحسب هنا بالسيرفر (لا نثق بأي سعر يجي من المتصفح). قبل الضريبة.
create or replace function public.partner_price_lines(p_partner uuid, p_services jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  ln jsonb; svc public.partner_services%rowtype; v_price numeric; v_qty integer;
  v_sub numeric := 0; v_lines jsonb := '[]'::jsonb; v_names text[] := '{}';
begin
  if jsonb_typeof(p_services) is distinct from 'array' or jsonb_array_length(p_services) = 0 then
    raise exception 'no_services';
  end if;
  for ln in select * from jsonb_array_elements(p_services) loop
    select * into svc from public.partner_services where id = (ln->>'service_id')::uuid and is_active;
    if not found then raise exception 'service_not_found'; end if;
    v_qty := greatest(1, least(coalesce(nullif(ln->>'qty', '')::integer, 1), 50));
    select coalesce(
      (select pp.price from public.partner_prices pp where pp.partner_id = p_partner and pp.service_id = svc.id),
      svc.base_price
    ) into v_price;
    if coalesce(v_price, 0) <= 0 then raise exception 'price_not_set: %', svc.name_ar; end if;
    v_sub   := v_sub + round(v_price * v_qty, 2);
    v_names := v_names || (svc.name_ar || case when v_qty > 1 then ' ×' || v_qty else '' end);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'service_id', svc.id, 'name', svc.name_ar, 'qty', v_qty, 'unit_price', v_price));
  end loop;
  return jsonb_build_object('subtotal', v_sub, 'lines', v_lines, 'names', to_jsonb(v_names));
end $$;

-- ─── 5) إدارة الشركات (service_role فقط) ────────────────────────────
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
          where o.payment_status = 'unpaid' and o.status = 'completed'
            and o.payment_due_date <= (now() at time zone 'Asia/Riyadh')::date),
      'due_total', coalesce(sum(o.total_price) filter (
          where o.payment_status = 'unpaid' and o.status = 'completed'
            and o.payment_due_date <= (now() at time zone 'Asia/Riyadh')::date), 0)
    ) as x
    from public.partners p
    left join public.orders o on o.partner_id = p.id
    group by p.id
  ) s;
$$;

create or replace function public.partner_admin_create(
  p_name text, p_vat text default null, p_cr text default null,
  p_address text default null, p_phone text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; v_bytes bytea; v_id uuid; i integer;
begin
  if coalesce(btrim(p_name), '') = '' then raise exception 'missing_name'; end if;
  if coalesce(btrim(p_vat), '') <> '' and btrim(p_vat) !~ '^3\d{13}3$' then raise exception 'invalid_vat'; end if;
  loop
    v_bytes := gen_random_bytes(12);
    v_code := '';
    for i in 0..11 loop
      v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.partners
                          where code_hash = encode(sha256(convert_to(v_code, 'utf8')), 'hex'));
  end loop;
  insert into public.partners (name, code_hash, vat_number, cr_number, address, phone)
  values (left(btrim(p_name), 80), encode(sha256(convert_to(v_code, 'utf8')), 'hex'),
          nullif(btrim(p_vat), ''), nullif(btrim(p_cr), ''), nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public.partner_admin_update(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if p ? 'vat_number' and coalesce(btrim(p->>'vat_number'), '') <> '' and btrim(p->>'vat_number') !~ '^3\d{13}3$' then
    raise exception 'invalid_vat';
  end if;
  update public.partners set
    name       = coalesce(nullif(left(btrim(p->>'name'), 80), ''), name),
    vat_number = case when p ? 'vat_number' then nullif(btrim(p->>'vat_number'), '') else vat_number end,
    cr_number  = case when p ? 'cr_number'  then nullif(btrim(p->>'cr_number'),  '') else cr_number  end,
    address    = case when p ? 'address'    then nullif(btrim(p->>'address'),    '') else address    end,
    phone      = case when p ? 'phone'      then nullif(btrim(p->>'phone'),      '') else phone      end,
    payment_terms_days = coalesce(nullif(p->>'payment_terms_days', '')::integer, payment_terms_days),
    turnaround_days    = coalesce(nullif(p->>'turnaround_days', '')::integer, turnaround_days)
  where id = p_id;
  if not found then raise exception 'partner_not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.partner_admin_set_active(p_id text, p_active boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.partners set is_active = coalesce(p_active, false) where id = p_id::uuid;
  if not found then raise exception 'partner_not_found'; end if;
end $$;

-- ─── 6) صفحة حساب الشركة ────────────────────────────────────────────
create or replace function public.partner_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare pr public.partners%rowtype;
begin
  select * into pr from public.partners where id = p_id;
  if not found then raise exception 'partner_not_found'; end if;
  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', pr.id, 'name', pr.name, 'is_active', pr.is_active, 'vat_number', pr.vat_number,
      'cr_number', pr.cr_number, 'address', pr.address, 'phone', pr.phone,
      'payment_terms_days', pr.payment_terms_days, 'turnaround_days', pr.turnaround_days),
    'today', (now() at time zone 'Asia/Riyadh')::date,
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name_ar', s.name_ar, 'base_price', s.base_price,
        'custom_price', pp.price, 'price', coalesce(pp.price, s.base_price), 'is_active', s.is_active
      ) order by s.sort_order, s.name_ar), '[]'::jsonb)
      from public.partner_services s
      left join public.partner_prices pp on pp.service_id = s.id and pp.partner_id = p_id),
    'orders', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
      from (select o.id, o.order_number, o.partner_ref, o.status, o.payment_status, o.subtotal, o.vat_amount,
                   o.total_price, o.created_at, o.delivery_date, o.delivered_at, o.payment_due_date,
                   o.partner_invoice_id, o.description, o.order_items, o.source, o.customer_name
            from public.orders o where o.partner_id = p_id
            order by o.created_at desc limit 1500) t),
    'invoices', (
      select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc), '[]'::jsonb)
      from (select si.id, si.invoice_number, si.created_at, si.subtotal, si.vat_amount, si.total,
                   si.zatca_status, si.zatca_qr, si.items, si.payment_method,
                   si.buyer_company_name, si.buyer_vat_number, si.buyer_cr_number, si.buyer_address,
                   (select count(*) from public.orders oo where oo.partner_invoice_id = si.id) as order_count
            from public.sales_invoices si
            where si.id in (select partner_invoice_id from public.orders
                            where partner_id = p_id and partner_invoice_id is not null)
            order by si.created_at desc limit 500) i)
  );
end $$;

-- ─── 7) كتالوج الخدمات والأسعار (المدير فقط، يُفرض بالـ API) ─────────
create or replace function public.partner_save_service(
  p_id uuid, p_name text, p_base numeric, p_active boolean default true)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_name), '') = '' then raise exception 'missing_name'; end if;
  if p_base is null or p_base < 0 then raise exception 'invalid_price'; end if;
  if p_id is null then
    insert into public.partner_services (name_ar, base_price, sort_order, is_active)
    values (left(btrim(p_name), 80), round(p_base, 2),
            coalesce((select max(sort_order) + 1 from public.partner_services), 1), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.partner_services
       set name_ar = left(btrim(p_name), 80), base_price = round(p_base, 2), is_active = coalesce(p_active, true)
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'service_not_found'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- p_prices: [{service_id, price}] — price فاضي/null = حذف السعر الخاص (الرجوع للأساسي)
create or replace function public.partner_set_prices(p_partner uuid, p_prices jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; v_price numeric;
begin
  perform 1 from public.partners where id = p_partner;
  if not found then raise exception 'partner_not_found'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) loop
    if coalesce(btrim(r->>'price'), '') = '' then
      delete from public.partner_prices where partner_id = p_partner and service_id = (r->>'service_id')::uuid;
    else
      v_price := round((r->>'price')::numeric, 2);
      if v_price < 0 then raise exception 'invalid_price'; end if;
      insert into public.partner_prices (partner_id, service_id, price)
      values (p_partner, (r->>'service_id')::uuid, v_price)
      on conflict (partner_id, service_id) do update set price = excluded.price;
    end if;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- ─── 8) استلام شنط الشركة: طلب مستقل لكل شنطة ───────────────────────
-- p_bags: [{label, notes, services:[{service_id, qty}]}]
create or replace function public.partner_create_orders(
  p_partner uuid, p_bags jsonb,
  p_employee_id uuid default null, p_employee_name text default null,
  p_branch_id uuid default null, p_branch_name text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  pr public.partners%rowtype; bag jsonb; pl jsonb; v_sub numeric; v_vat numeric;
  v_note text; v_label text; v_ord public.orders%rowtype; v_out jsonb := '[]'::jsonb; v_delivery date;
begin
  select * into pr from public.partners where id = p_partner and is_active;
  if not found then raise exception 'partner_not_found_or_inactive'; end if;
  if jsonb_typeof(p_bags) is distinct from 'array' or jsonb_array_length(p_bags) = 0 then raise exception 'no_bags'; end if;
  if jsonb_array_length(p_bags) > 100 then raise exception 'too_many_bags'; end if;
  v_delivery := (now() at time zone 'Asia/Riyadh')::date + pr.turnaround_days;

  for bag in select * from jsonb_array_elements(p_bags) loop
    v_label := left(btrim(coalesce(bag->>'label', '')), 100);
    v_note  := left(btrim(coalesce(bag->>'notes', '')), 500);
    pl      := public.partner_price_lines(p_partner, bag->'services');
    v_sub   := (pl->>'subtotal')::numeric;
    v_vat   := round(v_sub * 0.15, 2);

    insert into public.orders (
      customer_name, customer_phone, item_type, description, status, quantity,
      partner_id, partner_ref, is_b2b, buyer_company_name, buyer_vat_number, buyer_cr_number, buyer_address,
      source, delivery_date, payment_status, paid, subtotal, vat_amount, total_price, order_items,
      employee_id, employee_name, branch_id, branch_name)
    values (
      pr.name, coalesce(pr.phone, ''), 'bag',
      array_to_string(array(select jsonb_array_elements_text(pl->'names')), '، ')
        || case when v_note <> '' then ' — ' || v_note else '' end,
      'pending', 1,
      p_partner, nullif(v_label, ''), true, pr.name, pr.vat_number, pr.cr_number, pr.address,
      'partner', v_delivery, 'unpaid', false, v_sub, v_vat, v_sub + v_vat,
      jsonb_build_array(jsonb_build_object(
        'item_type', 'bag', 'services', pl->'names', 'description', v_note, 'lines', pl->'lines')),
      p_employee_id, p_employee_name, p_branch_id, p_branch_name)
    returning * into v_ord;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', v_ord.id, 'order_number', v_ord.order_number, 'label', v_ord.partner_ref,
      'total_price', v_ord.total_price, 'delivery_date', v_ord.delivery_date));
  end loop;
  return v_out;
end $$;

-- تحديد/تعديل خدمات شنطة غير مفوتَرة (مثلاً طلب أرسلته الشركة من البوابة بدون تسعير)
create or replace function public.partner_reprice_order(p_order_id uuid, p_services jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare o public.orders%rowtype; pl jsonb; v_sub numeric; v_vat numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.partner_id is null then raise exception 'order_not_found'; end if;
  if o.partner_invoice_id is not null or o.payment_status <> 'unpaid' then raise exception 'order_already_invoiced'; end if;
  if o.status = 'cancelled' then raise exception 'order_cancelled'; end if;
  pl    := public.partner_price_lines(o.partner_id, p_services);
  v_sub := (pl->>'subtotal')::numeric;
  v_vat := round(v_sub * 0.15, 2);
  perform set_config('app.partner_pricing', '1', true);
  update public.orders set
    subtotal = v_sub, vat_amount = v_vat, total_price = v_sub + v_vat,
    description = array_to_string(array(select jsonb_array_elements_text(pl->'names')), '، '),
    order_items = jsonb_build_array(jsonb_build_object(
      'item_type', coalesce(o.item_type::text, 'bag'), 'services', pl->'names',
      'description', coalesce(o.order_items->0->>'description', ''), 'lines', pl->'lines'))
  where id = p_order_id;
  perform set_config('app.partner_pricing', '', true);
  return jsonb_build_object('ok', true, 'total_price', v_sub + v_vat);
end $$;

-- ─── 9) إصدار فاتورة ضريبية مجمّعة لعدة شنط (السداد) ────────────────
create or replace function public.partner_issue_invoice(
  p_partner uuid, p_order_ids uuid[], p_payment_method text default 'online',
  p_employee_id uuid default null, p_employee_name text default null,
  p_branch_id uuid default null, p_branch_name text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  pr public.partners%rowtype; o public.orders%rowtype; ln jsonb; v_ids uuid[];
  v_items jsonb := '[]'::jsonb; v_sub numeric := 0; v_vat numeric := 0; v_bad text;
  v_inv public.sales_invoices%rowtype; v_pm public.payment_method; v_n integer := 0;
begin
  select * into pr from public.partners where id = p_partner;
  if not found then raise exception 'partner_not_found'; end if;
  if coalesce(pr.vat_number, '') !~ '^3\d{13}3$' then raise exception 'partner_vat_missing'; end if;
  v_ids := array(select distinct x from unnest(p_order_ids) x);
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'no_orders'; end if;
  v_pm := p_payment_method::public.payment_method;

  perform 1 from public.orders where id = any(v_ids) order by id for update;
  if (select count(*) from public.orders where id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'orders_not_found';
  end if;
  select string_agg(order_number, '، ') into v_bad from public.orders
   where id = any(v_ids)
     and (partner_id is distinct from p_partner or partner_invoice_id is not null
          or payment_status <> 'unpaid' or status <> 'completed' or coalesce(total_price, 0) <= 0);
  if v_bad is not null then raise exception 'orders_not_invoiceable: %', v_bad; end if;

  for o in select * from public.orders where id = any(v_ids) order by created_at, order_number loop
    v_n := v_n + 1;
    if jsonb_array_length(coalesce(o.order_items->0->'lines', '[]'::jsonb)) = 0 then
      raise exception 'order_without_services: %', o.order_number;
    end if;
    for ln in select * from jsonb_array_elements(o.order_items->0->'lines') loop
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'item_name', (ln->>'name') || ' — ' || o.order_number || coalesce(' (' || o.partner_ref || ')', ''),
        'qty', (ln->>'qty')::integer, 'sell_price', (ln->>'unit_price')::numeric, 'order_id', o.id));
      v_sub := v_sub + round((ln->>'unit_price')::numeric * (ln->>'qty')::integer, 2);
      v_vat := v_vat + round((ln->>'unit_price')::numeric * (ln->>'qty')::integer * 0.15, 2);
    end loop;
  end loop;

  insert into public.sales_invoices (
    customer_name, customer_phone, customer_vat, customer_address, customer_cr_number,
    items, subtotal, vat_amount, total, payment_method, payment_status, month_key,
    cost_total, gross_profit, branch_id, branch_name, employee_id, employee_name,
    is_b2b, buyer_company_name, buyer_vat_number, buyer_cr_number, buyer_address)
  values (
    pr.name, pr.phone, pr.vat_number, pr.address, pr.cr_number,
    v_items, v_sub, v_vat, v_sub + v_vat, v_pm, 'paid',
    to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM'),
    0, v_sub, p_branch_id, p_branch_name, p_employee_id, p_employee_name,
    true, pr.name, pr.vat_number, pr.cr_number, pr.address)
  returning * into v_inv;

  update public.orders
     set partner_invoice_id = v_inv.id, payment_status = 'paid', paid = true, payment_method = v_pm
   where id = any(v_ids);

  return jsonb_build_object('invoice_id', v_inv.id, 'invoice_number', v_inv.invoice_number,
    'subtotal', v_sub, 'vat_amount', v_vat, 'total', v_sub + v_vat, 'order_count', v_n);
end $$;

-- ─── 10) بوابة الشركاء (/partner): تُستدعى من المتصفح برمز الشركة ───
create or replace function public.partner_login(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare pr public.partners%rowtype;
begin
  select * into pr from public.partners
   where is_active and code_hash = encode(sha256(convert_to(upper(btrim(coalesce(p_code, ''))), 'utf8')), 'hex');
  if not found then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  return jsonb_build_object('ok', true, 'name', pr.name);
end $$;

create or replace function public.partner_orders(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare pr public.partners%rowtype;
begin
  select * into pr from public.partners
   where is_active and code_hash = encode(sha256(convert_to(upper(btrim(coalesce(p_code, ''))), 'utf8')), 'hex');
  if not found then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  return jsonb_build_object(
    'ok', true, 'name', pr.name,
    'open',      (select count(*) from public.orders where partner_id = pr.id and status in ('pending','in_progress','ready')),
    'completed', (select count(*) from public.orders where partner_id = pr.id and status = 'completed'),
    'month_orders', (select count(*) from public.orders where partner_id = pr.id
                      and created_at >= (date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh')),
    'orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'order_number', o.order_number, 'customer_name', o.customer_name, 'item_type', o.item_type,
        'status', o.status, 'issue', o.description, 'partner_ref', o.partner_ref,
        'created_at', o.created_at, 'delivery_date', o.delivery_date) order by o.created_at desc), '[]'::jsonb)
      from (select * from public.orders where partner_id = pr.id order by created_at desc limit 300) o)
  );
end $$;

create or replace function public.partner_submit_order(p_code text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  pr public.partners%rowtype; v_name text; v_phone text; v_issue text; v_ref text;
  v_type public.item_type; v_existing text; v_new text;
begin
  select * into pr from public.partners
   where is_active and code_hash = encode(sha256(convert_to(upper(btrim(coalesce(p_code, ''))), 'utf8')), 'hex');
  if not found then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;

  v_name  := btrim(coalesce(p->>'customer_name', ''));
  v_phone := regexp_replace(coalesce(p->>'customer_phone', ''), '\s', '', 'g');
  v_issue := btrim(coalesce(p->>'issue', ''));
  v_ref   := nullif(btrim(coalesce(p->>'partner_ref', '')), '');
  if v_name = '' or length(v_name) > 120 then return jsonb_build_object('ok', false, 'error', 'invalid_name'); end if;
  if v_phone !~ '^05\d{8}$' then return jsonb_build_object('ok', false, 'error', 'invalid_phone'); end if;
  if v_issue = '' or length(v_issue) > 1000 then return jsonb_build_object('ok', false, 'error', 'invalid_issue'); end if;
  if v_ref is not null and length(v_ref) > 100 then return jsonb_build_object('ok', false, 'error', 'invalid_ref'); end if;
  if (select count(*) from public.orders where partner_id = pr.id and created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if v_ref is not null then
    select order_number into v_existing from public.orders where partner_id = pr.id and partner_ref = v_ref limit 1;
    if v_existing is not null then
      return jsonb_build_object('ok', true, 'created', false, 'order_number', v_existing);
    end if;
  end if;

  v_type := case when (p->>'item_type') in ('shoes','bag','dress','suit','jacket','pants','shirt','other')
                  then (p->>'item_type')::public.item_type else 'other'::public.item_type end;

  insert into public.orders (
    customer_name, customer_phone, item_type, description, status, quantity,
    partner_id, partner_ref, is_b2b, buyer_company_name, buyer_vat_number, buyer_cr_number, buyer_address,
    source, delivery_date, payment_status, paid, subtotal, vat_amount, total_price, order_items)
  values (
    v_name, v_phone, v_type, v_issue, 'pending', 1,
    pr.id, v_ref, true, pr.name, pr.vat_number, pr.cr_number, pr.address,
    'partner', (now() at time zone 'Asia/Riyadh')::date + pr.turnaround_days, 'unpaid', false, 0, 0, 0,
    jsonb_build_array(jsonb_build_object('item_type', v_type::text, 'services', '[]'::jsonb, 'description', v_issue)))
  returning order_number into v_new;

  return jsonb_build_object('ok', true, 'created', true, 'order_number', v_new);
end $$;

-- ─── 11) الصلاحيات ──────────────────────────────────────────────────
-- Supabase يمنح EXECUTE تلقائياً لـ anon/authenticated على أي دالة جديدة؛
-- دوال الإدارة والمال نسحبها صراحةً ونتركها لـ service_role فقط.
revoke all on function public.partner_price_lines(uuid, jsonb)                          from public, anon, authenticated;
revoke all on function public.partner_admin_list()                                      from public, anon, authenticated;
revoke all on function public.partner_admin_create(text, text, text, text, text)        from public, anon, authenticated;
revoke all on function public.partner_admin_update(uuid, jsonb)                         from public, anon, authenticated;
revoke all on function public.partner_admin_set_active(text, boolean)                   from public, anon, authenticated;
revoke all on function public.partner_detail(uuid)                                      from public, anon, authenticated;
revoke all on function public.partner_save_service(uuid, text, numeric, boolean)        from public, anon, authenticated;
revoke all on function public.partner_set_prices(uuid, jsonb)                           from public, anon, authenticated;
revoke all on function public.partner_create_orders(uuid, jsonb, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.partner_reprice_order(uuid, jsonb)                        from public, anon, authenticated;
revoke all on function public.partner_issue_invoice(uuid, uuid[], text, uuid, text, uuid, text) from public, anon, authenticated;

grant execute on function public.partner_price_lines(uuid, jsonb)                          to service_role;
grant execute on function public.partner_admin_list()                                      to service_role;
grant execute on function public.partner_admin_create(text, text, text, text, text)        to service_role;
grant execute on function public.partner_admin_update(uuid, jsonb)                         to service_role;
grant execute on function public.partner_admin_set_active(text, boolean)                   to service_role;
grant execute on function public.partner_detail(uuid)                                      to service_role;
grant execute on function public.partner_save_service(uuid, text, numeric, boolean)        to service_role;
grant execute on function public.partner_set_prices(uuid, jsonb)                           to service_role;
grant execute on function public.partner_create_orders(uuid, jsonb, uuid, text, uuid, text) to service_role;
grant execute on function public.partner_reprice_order(uuid, jsonb)                        to service_role;
grant execute on function public.partner_issue_invoice(uuid, uuid[], text, uuid, text, uuid, text) to service_role;

-- بوابة الشركاء: تُستدعى من المتصفح بمفتاح anon، والرمز نفسه هو التحقق.
grant execute on function public.partner_login(text)               to anon, authenticated;
grant execute on function public.partner_orders(text)              to anon, authenticated;
grant execute on function public.partner_submit_order(text, jsonb) to anon, authenticated;
