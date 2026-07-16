-- ══════════════════════════════════════════════════════════════════
-- 016 — فواتير B2B (شركات) + تعبئة بيانات المنشأة الحقيقية بإعدادات زاتكا
-- ══════════════════════════════════════════════════════════════════
-- الهدف: تمكين "إنشاء طلب" (إصلاح ومبيعات منتجات) من إصدار فاتورة
-- لصالح شركة (B2B) بدل فرد، بحفظ بيانات المشتري (اسم الشركة/الرقم
-- الضريبي/رقم السجل التجاري/العنوان) على نفس سجل الطلب أو فاتورة
-- البيع مباشرة — بدون الحاجة لجدول "عملاء شركات" منفصل، لأن
-- customer_name/customer_phone الحاليين يبقيان لجهة الاتصال الفردية
-- المسؤولة، وحقول buyer_* الجديدة تحمل بيانات الشركة نفسها.

alter table orders add column if not exists is_b2b boolean not null default false;
alter table orders add column if not exists buyer_company_name text;
alter table orders add column if not exists buyer_vat_number text;
alter table orders add column if not exists buyer_cr_number text;
alter table orders add column if not exists buyer_address text;

alter table sales_invoices add column if not exists is_b2b boolean not null default false;
alter table sales_invoices add column if not exists buyer_company_name text;
alter table sales_invoices add column if not exists buyer_vat_number text;
alter table sales_invoices add column if not exists buyer_cr_number text;
alter table sales_invoices add column if not exists buyer_address text;

create index if not exists idx_orders_is_b2b on orders(is_b2b) where is_b2b = true;
create index if not exists idx_sales_invoices_is_b2b on sales_invoices(is_b2b) where is_b2b = true;

-- ─── تعبئة بيانات المنشأة الحقيقية (من نموذج الفاتورة المُرسل) ───
-- ملاحظة مهمة: "7051288830" الموجود بتصميم الفاتورة هو رقم السجل
-- التجاري (C.R / س.ت) — 10 أرقام — وليس الرقم الضريبي. الرقم الضريبي
-- السعودي 15 رقماً ويبدأ وينتهي بـ 3 (مثال: 3xxxxxxxxxxxxx3). لذلك
-- نملأ هنا كل شيء عدا vat_number، وتبقى خانته فاضية حتى تُدخله بنفسك
-- من صفحة إعدادات زاتكا — فاتورة برقم ضريبي خاطئ تُرفض فوراً من هيئة
-- الزكاة والضريبة والجمارك.
update zatca_settings set
  seller_name     = 'إبرة وخيط الإسكافي',
  cr_number       = coalesce(nullif(cr_number, ''), '7051288830'),
  city            = 'الرياض',
  district        = 'العزيزية',
  street          = 'شارع الشباب',
  postal_code     = coalesce(nullif(postal_code, ''), '11111'),
  building_number = coalesce(nullif(building_number, ''), '0000')
where id = 1;
