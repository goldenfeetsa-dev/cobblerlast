import { useEffect, useRef } from 'react';

// أقصى فارق زمني (بالمللي ثانية) بين ضغطتين متتاليتين حتى تُعتبر من ماسح
// باركود حقيقي — أي إنسان يكتب أبطأ من كذا بكثير، بينما الماسح يرسل الحروف
// خلال أجزاء من المللي ثانية.
const MAX_INTERVAL_MS = 40;
// أقل عدد أحرف حتى نعتبرها باركود فعلي (يتفادى ضغطات عرضية قصيرة)
const MIN_LENGTH = 4;

/**
 * useGlobalBarcodeScanner
 * ─────────────────────────────────────────────────────────────
 * يجعل أي ماسح باركود (USB أو لاسلكي 2.4G) يعمل من أي مكان بالتطبيق
 * فوراً دون الحاجة للتركيز على حقل معيّن أو فتح صفحة "مسح الباركود" —
 * بمجرد ما الموظف يمسح أي كود، يُستدعى onScan(code) مباشرة.
 *
 * يتجاهل الكتابة اليدوية العادية بالحقول (بطيئة نسبياً)، ولا يتدخل إذا
 * كان التركيز داخل حقل معلَّم بـ data-scanner-safe="true" (يعني تلك
 * الصفحة تتولى معالجة المسح بنفسها، كصفحة "مسح الباركود" المخصصة).
 */
export function useGlobalBarcodeScanner(onScan, { enabled = true } = {}) {
  const buffer = useRef('');
  const lastTime = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // تجاهل مفاتيح التحكم (Shift, Ctrl, Alt...) إلا Enter
      if (e.key.length > 1 && e.key !== 'Enter') return;

      const now = Date.now();
      const delta = now - lastTime.current;
      lastTime.current = now;

      if (e.key === 'Enter') {
        const code = buffer.current;
        const fastEnough = delta < MAX_INTERVAL_MS;
        buffer.current = '';

        if (code.length < MIN_LENGTH || !fastEnough) return; // كتابة يدوية عادية — تجاهل

        const active = document.activeElement;
        const isSelfHandled = active?.dataset?.scannerSafe === 'true';
        if (isSelfHandled) return; // الصفحة الحالية تتولى المسح بنفسها

        const isGenericField = active && ['INPUT', 'TEXTAREA'].includes(active.tagName);
        if (isGenericField) {
          e.preventDefault();
          // نفرّغ ما تمت كتابته بالخطأ بالحقل أثناء المسح (بدون كسر تحكم React بالحقل)
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          setter?.call(active, '');
          active.dispatchEvent(new Event('input', { bubbles: true }));
        }

        onScanRef.current?.(code);
        return;
      }

      if (delta > MAX_INTERVAL_MS) {
        buffer.current = ''; // فاصل زمني كبير = بداية كتابة/مسح جديد
      }
      buffer.current += e.key;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled]);
}
