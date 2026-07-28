-- ══════════════════════════════════════════════════════════════════
-- 027 — إحداثيات موقع التوصيل + تحديث قائمة الحقول المسموح
-- تعديلها بعد الإبلاغ لزاتكا
-- ────────────────────────────────────────────────────────────────
-- عنوان التوصيل النصي كان موجود، لكن ما فيه إحداثيات (lat/lng) —
-- فمكوّن الخريطة الجديد ما كان له وين يحفظ الموقع المُحدَّد، وصفحة
-- الإدارة ما كانت تقدر تعرضه أصلاً. هذا يضيف العمودين، ويسمح
-- بتعديلهما حتى بعد إبلاغ الفاتورة لزاتكا (بيانات لوجستية، مو محتوى
-- مالي، فما تخالف قاعدة "اللا تعديل").
-- ══════════════════════════════════════════════════════════════════

alter table orders add column if not exists delivery_lat double precision;
alter table orders add column if not exists delivery_lng double precision;

create or replace function zatca_protect_reported_invoice()
returns trigger
language plpgsql
as $$
declare
  v_allowed text[] := array[
    'status', 'payment_status', 'notes', 'internal_notes',
    'delivery_date', 'delivered_at', 'delivery_address', 'delivery_lat', 'delivery_lng',
    'updated_at',
    'zatca_status', 'zatca_qr', 'zatca_invoice_hash', 'zatca_uuid',
    'zatca_submitted_at', 'zatca_retry_count', 'zatca_error_category',
    'zatca_needs_review'
  ];
  v_ref_old text;
begin
  if TG_OP = 'DELETE' then
    if OLD.zatca_status in ('REPORTED', 'CLEARED') then
      v_ref_old := coalesce(to_jsonb(OLD) ->> 'order_number', to_jsonb(OLD) ->> 'invoice_number', OLD.id::text);
      raise exception 'لا يمكن حذف فاتورة تم اعتمادها وإرسالها لهيئة الزكاة والضريبة (رقم %). لتصحيح خطأ، أصدر إشعار دائن/مدين مرتبط بها.', v_ref_old
        using errcode = '23514';
    end if;
    return OLD;
  end if;

  if TG_OP = 'UPDATE' and OLD.zatca_status in ('REPORTED', 'CLEARED') then
    v_ref_old := coalesce(to_jsonb(OLD) ->> 'order_number', to_jsonb(OLD) ->> 'invoice_number', OLD.id::text);

    if (to_jsonb(NEW) ->> 'status') is distinct from (to_jsonb(OLD) ->> 'status')
       and (to_jsonb(NEW) ->> 'status') in ('cancelled', 'returned')
       and coalesce(to_jsonb(OLD) ->> 'status', '') not in ('cancelled', 'returned') then
      raise exception 'لا يمكن إلغاء/استرجاع فاتورة مُبلَّغة لزاتكا (رقم %) مباشرة. أصدر إشعار دائن أولاً، ثم يمكن تحديث الحالة الداخلية.', v_ref_old
        using errcode = '23514';
    end if;

    if zatca_is_protected_field_change(to_jsonb(OLD), to_jsonb(NEW), v_allowed) then
      raise exception 'هذه الفاتورة معتمدة ومُبلَّغة لزاتكا (رقم %) — سجلها للقراءة فقط ولا يجوز تعديل بياناتها المالية. أصدر إشعار دائن/مدين بدلاً من التعديل.', v_ref_old
        using errcode = '23514';
    end if;
  end if;

  return NEW;
end;
$$;
