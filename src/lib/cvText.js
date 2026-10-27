/**
 * cvText — استخراج نص السيرة الذاتية داخل المتصفح (لا يُرسل الملف لأي خدمة خارجية).
 * PDF عبر pdf.js، وWord (docx) عبر mammoth، وtxt مباشرة؛ كلها تُحمَّل عند الحاجة فقط.
 */
export const CV_MAX_BYTES = 3 * 1024 * 1024;
export const CV_ACCEPT = '.pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export async function extractCvText(file) {
  const name = (file.name || '').toLowerCase();
  try {
    if (name.endsWith('.txt') || file.type === 'text/plain') return (await file.text()).slice(0, 30000);
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist/build/pdf.js');
      const worker = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = worker;
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
      let out = '';
      for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        out += content.items.map((it) => it.str).join(' ') + '\n';
      }
      return out.slice(0, 30000);
    }
    if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth/mammoth.browser');
      const r = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return (r.value || '').slice(0, 30000);
    }
  } catch (e) {
    console.warn('cv extract failed', e);
  }
  return ''; // ملف غير مدعوم/ممسوح ضوئياً: يُرفع الملف بدون نص
}
