/**
 * invoiceOcr.js
 * ─────────────────────────────────────────────────────────────
 * مساعد OCR (تعرّف ضوئي على الحروف) لتقليل الخطأ البشري عند إدخال
 * فواتير الشراء: يقرأ صورة الفاتورة داخل المتصفح (بدون رفعها لأي
 * خادم خارجي) عبر Tesseract.js، ثم يحاول استخراج الحقول الشائعة
 * (رقم الفاتورة، التاريخ، الإجمالي، الرقم الضريبي للمورد) بأنماط
 * نصية شائعة عربي/إنجليزي.
 *
 * تنبيه صريح: هذا استخراج تقريبي (Best-effort) وليس تحققاً رسمياً؛
 * لازم المستخدم يراجع كل حقل قبل الحفظ. لدقة أعلى (وربط فعلي بمنظومة
 * الفوترة الإلكترونية) يلزم الاشتراك بخدمة OCR/تحقق متخصصة ذات API
 * معتمد — هذه الدالة نقطة انطلاق محلية مجانية فقط.
 */
import { createWorker } from 'tesseract.js';

const VAT_NUMBER_RE = /3\d{13}3/;
const DATE_RE = /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})/;
const INVOICE_NO_RE = /(?:invoice\s*(?:no|number|#)?|رقم\s*الفاتورة)\s*[:#]?\s*([A-Za-z0-9\-\/]{3,20})/i;
const TOTAL_RE = /(?:total|إجمالي|المجموع)\D{0,10}([\d,]+\.?\d{0,2})/i;

export async function extractInvoiceFieldsFromImage(file, onProgress) {
  const worker = await createWorker('ara+eng', 1, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') onProgress(Math.round((m.progress || 0) * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    const text = data.text || '';

    const vatMatch = text.match(VAT_NUMBER_RE);
    const dateMatch = text.match(DATE_RE);
    const invoiceMatch = text.match(INVOICE_NO_RE);
    const totalMatch = text.match(TOTAL_RE);

    return {
      rawText: text,
      vatNumber: vatMatch ? vatMatch[0] : '',
      date: dateMatch ? (dateMatch[1] || dateMatch[2] || '') : '',
      invoiceNumber: invoiceMatch ? invoiceMatch[1] : '',
      total: totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : null,
    };
  } finally {
    await worker.terminate();
  }
}
