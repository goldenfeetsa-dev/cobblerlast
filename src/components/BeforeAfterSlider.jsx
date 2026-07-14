/**
 * BeforeAfterSlider — مكوّن المقارنة التفاعلي "قبل / بعد"
 * ─────────────────────────────────────────────────────────────
 * صورتان متطابقتان في الأبعاد والزاوية فوق بعضهما:
 *  - السفلية (afterImage): حالة القطعة بعد الترميم.
 *  - العلوية (beforeImage): حالة القطعة قبل الترميم، تُقصّ (clip-path)
 *    تدريجياً أثناء السحب لتكشف الصورة السفلية تحتها.
 *
 * التحكم: مقبض دائري + خط رأسي، يُسحب بالفأرة أو الإصبع (Pointer Events)،
 * ويدعم أيضاً لوحة المفاتيح (الأسهم) لإمكانية الوصول.
 * الأداء: كل التحديث عبر clip-path مباشرة على الـ transform/paint فقط
 * (لا إعادة تخطيط Layout)، مع تجميع التحديثات داخل requestAnimationFrame
 * لضمان حركة سلسة بمعدل 60 إطاراً/ثانية فأكثر.
 */
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

export default function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'قبل',
  afterLabel = 'بعد',
  initialPosition = 50,
  aspectRatio = '4 / 3',
  className = '',
}) {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const pendingXRef = useRef(null);
  const [pos, setPos] = useState(initialPosition); // 0..100 من اليسار
  const [dragging, setDragging] = useState(false);

  // يحوّل إحداثية الفأرة/الإصبع (clientX) إلى نسبة مئوية داخل الحاوية
  const updateFromClientX = useCallback((clientX) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(100, Math.max(0, raw));
    setPos(clamped);
  }, []);

  // نجمع كل حركات pointermove في متغيّر ونطبّقها مرة وحدة كل إطار (rAF)
  // لضمان سلاسة الحركة وعدم إغراق الـ state بتحديثات أكثر مما يحتاجه المتصفح
  const scheduleUpdate = useCallback((clientX) => {
    pendingXRef.current = clientX;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingXRef.current != null) updateFromClientX(pendingXRef.current);
    });
  }, [updateFromClientX]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  }, [updateFromClientX]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    scheduleUpdate(e.clientX);
  }, [dragging, scheduleUpdate]);

  const stopDragging = useCallback(() => setDragging(false), []);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const handleKeyDown = useCallback((e) => {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === 'ArrowLeft') { setPos((p) => Math.max(0, p - step)); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setPos((p) => Math.min(100, p + step)); e.preventDefault(); }
    if (e.key === 'Home') { setPos(0); e.preventDefault(); }
    if (e.key === 'End') { setPos(100); e.preventDefault(); }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-2xl select-none touch-none ${className}`}
      style={{ aspectRatio, cursor: dragging ? 'grabbing' : 'ew-resize' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={() => dragging && stopDragging()}
    >
      {/* الصورة السفلية: بعد الترميم */}
      <img
        src={afterImage}
        alt={afterLabel}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* الصورة العلوية: قبل الترميم — تُقصّ تدريجياً لتكشف ما تحتها */}
      <img
        src={beforeImage}
        alt={beforeLabel}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)`, willChange: 'clip-path' }}
      />

      {/* تسميات "قبل" و "بعد" */}
      <span
        className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase transition-opacity duration-150 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.55)', color: '#F5EDD8', opacity: pos > 8 ? 1 : 0 }}
      >
        {beforeLabel}
      </span>
      <span
        className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase transition-opacity duration-150 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.55)', color: '#F5EDD8', opacity: pos < 92 ? 1 : 0 }}
      >
        {afterLabel}
      </span>

      {/* الخط الرأسي + المقبض */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px]" style={{ background: '#F5EDD8', boxShadow: '0 0 8px rgba(0,0,0,0.5)' }} />
        <div
          role="slider"
          tabIndex={0}
          aria-label={`${beforeLabel} / ${afterLabel}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={handleKeyDown}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center pointer-events-auto focus:outline-none focus:ring-2"
          style={{
            background: '#F5EDD8',
            border: '2px solid #C9A84C',
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            cursor: dragging ? 'grabbing' : 'grab',
          }}
        >
          <ChevronsLeftRight className="w-5 h-5" style={{ color: '#1A0C00' }} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
