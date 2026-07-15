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

/** تحقق شكلي فوري (متزامن، بدون شبكة) */
export function isValidVatFormat(vatNumber) {
  if (!vatNumber) return false;
  const cleaned = String(vatNumber).trim();
  return SAUDI_VAT_REGEX.test(cleaned);
}

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
