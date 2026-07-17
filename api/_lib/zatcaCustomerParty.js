/**
 * zatcaCustomerParty.js
 * ─────────────────────────────────────────────────────────────────
 * منطق الفصل بين B2B (فاتورة ضريبية قياسية) و B2C (فاتورة ضريبية
 * مبسّطة) — مصمم للعمل فوق نفس الحقول الموجودة فعلياً بجدولي
 * orders / sales_invoices بعد migration 016:
 *   is_b2b, buyer_company_name, buyer_vat_number, buyer_cr_number, buyer_address
 *
 * ⚠️ ملاحظة حرجة جداً قبل أي شيء (تأكدت منها بفحص مصدر الحزمة
 * المستخدمة فعلياً بمشروعك، zatca-xml-js@0.1.9):
 *
 * 1) القيمة 388 داخل <cbc:InvoiceTypeCode> هي نفسها دائماً لكل من
 *    القياسية والمبسّطة (تعني "فاتورة ضريبية" عموماً حسب قائمة
 *    UN/CEFACT 1001). 381 هي كود "إشعار دائن" (Credit Note) و383
 *    "إشعار مدين" (Debit Note) — لا علاقة لهما بـ B2B/B2C إطلاقاً.
 *    الفرق الحقيقي بين القياسية والمبسّطة هو داخل الـ name attribute
 *    لنفس العنصر (كود من 7 أرقام):
 *      - يبدأ بـ "01" = فاتورة ضريبية قياسية (Standard) → B2B
 *      - يبدأ بـ "02" = فاتورة ضريبية مبسّطة (Simplified) → B2C
 *    مثال مطابق تماماً لما تستخدمه مكتبتكم فعلياً: name="0100000" أو
 *    name="0200000" (الأصفار الباقية تُستخدم فقط لفواتير التصدير/
 *    self-billed/summary/third-party، تبقى صفراً بحالتكم العادية).
 *
 * 2) مكتبة zatca-xml-js@0.1.9 المستخدمة حالياً بـ api/_lib/zatcaEngine.js
 *    تبني فقط "فاتورة ضريبية مبسّطة" (ZATCASimplifiedTaxInvoice)، وقالبها
 *    الداخلي (simplified_tax_invoice_template.js) يحتوي حرفياً:
 *        <cac:AccountingCustomerParty></cac:AccountingCustomerParty>
 *    أي عنصر فاضٍ تماماً بدون أي prop لتعبئته — ولا توجد أي دالة
 *    Clearance بالمكتبة (فقط compliance().issueCertificate و
 *    production().reportInvoice — لا يوجد production().clearInvoice).
 *    وهذا يطابق تماماً ملاحظتكم داخل الكود الحالي بالمشروع.
 *
 *    ⇐ النتيجة العملية: لا يمكن إصدار فاتورة قياسية (B2B) حقيقية
 *    ومطابقة للهيئة بالاعتماد فقط على هذه المكتبة كما هي. المسارات
 *    الممكنة:
 *      (أ) تعديل القالب الداخلي للمكتبة (fork/patch) لإضافة عنصر
 *          AccountingCustomerParty وتغيير الـ name attribute ديناميكياً،
 *          ثم استدعاء مسار Clearance بدل Reporting يدوياً (نفس أسلوب
 *          fetch الموجود بـ zatcaEngine.js لكن على
 *          `${base}/invoices/clearance/single` مع الهيدر
 *          'Clearance-Status': '1' بدل '0').
 *      (ب) أو الانتقال لمكتبة/بناء XML يدوي كامل (مثال أدناه) يعطيك
 *          تحكماً كاملاً بكل العناصر.
 *    هذا الملف يطبّق الخيار (ب) كنقطة بداية آمنة ومفصولة، حتى تختبرها
 *    بمعزل عن مسار B2C الحالي (الذي يعمل وما ينبغي المساس فيه).
 */

import { isValidVatFormat } from '../src/lib/vatValidation.js';

// ── 1) تصنيف نوع الفاتورة ───────────────────────────────────────
export function isB2BInvoice(record) {
  return Boolean(record?.is_b2b);
}

// ── 2) كود نوع الفاتورة الصحيح (القيمة ثابتة 388 دائماً، والفرق
//       الحقيقي بالـ name) ─────────────────────────────────────
export function getInvoiceTypeCode(isB2B) {
  return {
    value: '388',                       // ثابت لكل من القياسية والمبسّطة
    name: isB2B ? '0100000' : '0200000', // 01xxxxx = قياسي / 02xxxxx = مبسّط
  };
}

// ── 3) التحقق قبل الإصدار: يمنع إصدار فاتورة B2B بدون رقم ضريبي صالح ──
export class InvoiceValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'InvoiceValidationError';
    this.field = field;
  }
}

export function validateBeforeIssue(record) {
  if (!isB2BInvoice(record)) return; // B2C: لا يوجد شرط رقم ضريبي للمشتري إطلاقاً

  if (!record.buyer_company_name || !String(record.buyer_company_name).trim()) {
    throw new InvoiceValidationError('فاتورة شركة (B2B) بدون اسم الشركة — أدخل اسم المنشأة المشترية أولاً', 'buyer_company_name');
  }
  if (!isValidVatFormat(record.buyer_vat_number)) {
    // هذا هو الشرط الذي طلبته: يمنع الإصدار فعلياً وليس فقط تحذيراً بالواجهة
    throw new InvoiceValidationError(
      'فاتورة شركة (B2B) لازم رقم ضريبي صحيح للمشتري (15 رقم، يبدأ وينتهي بـ 3) — تعذّر الإصدار',
      'buyer_vat_number'
    );
  }
  // CRN اختياري حسب الإرشادات الرسمية (BT-47 قد يكون رقم ضريبي أو سجل تجاري
  // أو رقم آخر معرّف)، لكن الأفضل عملياً اشتراطه أيضاً لأي عميل شركة حقيقي:
  if (!record.buyer_cr_number) {
    throw new InvoiceValidationError('فاتورة شركة (B2B) بدون رقم سجل تجاري للمشتري — أدخله قبل الإصدار', 'buyer_cr_number');
  }
}

// ── 4) بناء عنصر AccountingCustomerParty حسب النوع ─────────────────
// B2B: يجب إدراجه كاملاً (PartyTaxScheme + CompanyID + PartyLegalEntity...)
// B2C: يُترك فاضياً (نفس ما تفعله المكتبة الحالية بالضبط) — هذا مطابق
//      لإرشادات الهيئة: الفاتورة المبسّطة لا تتطلب بيانات المشتري أصلاً
//      (البند غير إلزامي بالمعيار لأن المشتري غالباً فرد بدون رقم ضريبي).
export function buildAccountingCustomerPartyXML(record) {
  if (!isB2BInvoice(record)) {
    return '<cac:AccountingCustomerParty></cac:AccountingCustomerParty>';
  }

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${esc(record.buyer_cr_number)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(record.buyer_address || 'NA')}</cbc:StreetName>
        <cbc:BuildingNumber>0000</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>NA</cbc:CitySubdivisionName>
        <cbc:CityName>NA</cbc:CityName>
        <cbc:PostalZone>00000</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(record.buyer_vat_number)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(record.buyer_company_name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

// ── 5) مسارات API المختلفة: Reporting (B2C) مقابل Clearance (B2B) ──
// B2C المبسّطة: تُرسَل خلال 24 ساعة (Reporting) — نفس اللي بالكود الحالي.
// B2B القياسية: يجب "تخليصها" فورياً قبل تسليمها للمشتري (Clearance) —
// الفرق فقط بالمسار والهيدر Clearance-Status، ورد الهيئة بالحالة القياسية
// يرجع الفاتورة موقّعة من الهيئة نفسها (Cryptographic Stamp) وهذا الرد هو
// ما يجب حفظه وطباعته للمشتري، وليس النسخة الموقعة محلياً فقط.
export function getSubmissionEndpoint(base, isB2B) {
  return isB2B
    ? { path: `${base}/invoices/clearance/single`, clearanceStatusHeader: '1' }
    : { path: `${base}/invoices/reporting/single`, clearanceStatusHeader: '0' };
}

// ── 6) حقول QR Code: الفرق بين B2C و B2B ────────────────────────────
// المرحلة الثانية (Integration Phase) من زاتكا تُلزم QR بـ 9 حقول TLV
// لكل من القياسية والمبسّطة على حد سواء (وليس فرقاً حصرياً لـ B2B):
//   1 اسم البائع   2 الرقم الضريبي للبائع   3 الطابع الزمني للإصدار
//   4 إجمالي الفاتورة شامل الضريبة          5 إجمالي ضريبة القيمة المضافة
//   6 هاش الفاتورة (XML Invoice Hash)        7 التوقيع الرقمي (ECDSA)
//   8 المفتاح العام (ECDSA Public Key)       9 توقيع الهيئة على الشهادة
//     (Certificate Signature / Cryptographic Stamp)
// الفرق العملي عند التحول من B2C إلى B2B هو مصدر القيم 6-9:
//   - بالمبسّطة (B2C): تُحسب وتُبنى محلياً عندك فور التوقيع (زي ما تفعل
//     invoice.sign() بالكود الحالي)، وتُرسَل للهيئة "بعد" إعطاء المشتري
//     نسخته (لأن الإرسال Reporting خلال 24 ساعة فقط).
//   - بالقياسية (B2B): لازم تُعاد تعبئة QR (خصوصاً tag 9، توقيع الهيئة)
//     من رد الـ Clearance API نفسه بعد أن "تُخلّص" الهيئة الفاتورة، لأن
//     الفاتورة القياسية لا يجوز تسليمها للمشتري إلا بعد التخليص الفوري —
//     أي أن QR/الفاتورة النهائية المطبوعة للعميل تُبنى من رد الهيئة، وليس
//     من النسخة الموقعة محلياً كما بمسار B2C الحالي.
export const QR_TAGS_NOTE = {
  sharedTags: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  b2bDifference: 'tags 6-9 تُعاد تعبئتها من رد Clearance API الرسمي، لا من التوقيع المحلي فقط',
};
