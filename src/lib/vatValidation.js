/**
 * vatValidation.js
 * ─────────────────────────────────────────────────────────────
 * تحقق شكلي (Format Validation) من الرقم الضريبي السعودي حسب
 * معيار هيئة الزكاة والضريبة والجمارك (ZATCA):
 *   - 15 رقماً بالضبط
 *   - يبدأ بالرقم 3 وينتهي بالرقم 3
 *
 * ملاحظة مهمة: هذا تحقق شكلي فقط (Format Check) يمنع كتابة رقم
 * ناقص أو بصيغة غلط لحظياً بالواجهة. التحقق الفعلي من أن الرقم
 * "مسجّل ومُفعّل" لدى الهيئة يتطلب استدعاء خدمة تحقق حقيقية
 * (API خاص بالهيئة أو مزوّد وسيط معتمد) تحتاج مفاتيح/اعتماد
 * production غير متوفرة هنا — الدالة `verifyVatNumberRemote`
 * أدناه هي نقطة الوصل الجاهزة لربطها بذلك الـ API لاحقاً.
 */

const SAUDI_VAT_REGEX = /^3\d{13}3$/;

// لوحات المفاتيح العربية (وبعض أجهزة آيفون/آندرويد بإعداد لغة عربي) تُدخل
// الأرقام بصيغة "٠١٢٣٤٥٦٧٨٩" (Arabic-Indic) أو "۰۱۲۳۴۵۶۷۸۹" (Extended
// Arabic-Indic/فارسي) بدل "0123456789" العادية. الرقم يبدو صحيحاً للعين
// تماماً، لكن /\d/ في جافاسكريبت لا يطابق إلا الأرقام اللاتينية، فيفشل
// التحقق دائماً بدون أي سبب ظاهر للمستخدم. نطبّع الأرقام أولاً هنا.
function normalizeDigits(input) {
  return String(input).replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    // ٠-٩ (Arabic-Indic): U+0660–U+0669 | ۰-۹ (Extended Arabic-Indic): U+06F0–U+06F9
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return d;
  });
}

/** تحقق شكلي فوري (متزامن، بدون شبكة) */
export function isValidVatFormat(vatNumber) {
  if (!vatNumber) return false;
  const cleaned = normalizeDigits(String(vatNumber).trim().replace(/\s+/g, ''));
  return SAUDI_VAT_REGEX.test(cleaned);
}

export { normalizeDigits };

/**
 * نقطة الوصل بخدمة التحقق الفعلية من تفعيل الرقم لدى الهيئة.
 * حالياً: تحقق شكلي فقط (fallback) لحين ربطها بـ API حقيقي.
 * لربطها لاحقاً: مرّر إليها نداء fetch لخدمة التحقق (ZATCA أو
 * مزوّد وسيط) وأرجع { valid, source: 'remote' }.
 */
export async function verifyVatNumberRemote(vatNumber) {
  const formatOk = isValidVatFormat(vatNumber);
  return { valid: formatOk, source: 'format-only', checkedAt: new Date().toISOString() };
}

export const VAT_RATE_DEFAULT = 15;
