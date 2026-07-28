-- ══════════════════════════════════════════════════════════════════
-- 025 — إصلاح شامل لدالة الحماية zatca_protect_reported_invoice
-- ────────────────────────────────────────────────────────────────
-- كانت فيها مشكلتان حقيقيتان من 021:
--
-- ١. الحقل "status" كان مسموح تغييره حتى على فاتورة REPORTED (لأسباب
--    تشغيلية شرعية: جاهز/مكتمل/تم التسليم). لكن هذا كان يسمح أيضاً
--    بقفز الحالة مباشرة لـ cancelled/returned بدون إشعار دائن — يعني
--    الفاتورة "تختفي" من التقارير محاسبياً وهي لسا مُعلنة عند زاتكا.
--    الآن status يُسمح يتغيّر لأي قيمة إلا cancelled/returned مباشرة.
--
-- ٢. رسائل الخطأ كانت تشير مباشرة لـ OLD.order_number و
--    OLD.invoice_number في نفس التعبير — وهذا الـ trigger مشترك بين
--    orders (فيها order_number بس) و sales_invoices (فيها
--    invoice_number بس). الوصول المباشر لعمود غير موجود بجدول معيّن
--    يفشل وقت التشغيل ("record has no field ..."). صُححت للوصول
--    الديناميكي عبر jsonb اللي ما يفشل أبداً على عمود غير موجود.
-- ══════════════════════════════════════════════════════════════════

create or replace function zatca_protect_reported_invoice()
returns trigger
language plpgsql
as $$
declare
  v_allowed text[] := array[
    'status', 'payment_status', 'notes', 'internal_notes',
    'delivery_date', 'delivered_at', 'updated_at',
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
