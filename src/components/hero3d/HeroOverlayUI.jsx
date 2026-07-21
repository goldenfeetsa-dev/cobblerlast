import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, CalendarCheck, X, CheckCircle2, Circle, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { useHeroStore } from '@/lib/hero3d/store';

const GOLD = '#C9A84C';
const CREAM = '#EDE4D0';

// خطوات تتبع الطلب — نفس مفهوم "تتبع طلبك" بالتصميم الأصلي
const TRACKING_STEPS = [
  { label: 'استلام الطلب', done: true },
  { label: 'ترميم الجلد', done: true },
  { label: 'تنظيف ومعالجة', done: false, active: true },
  { label: 'فحص الجودة', done: false },
  { label: 'جاهز للتسليم', done: false },
];

function TrackingPanel() {
  return (
    <div className="w-72 sm:w-80">
      <div className="text-sm font-black mb-3" style={{ color: CREAM }}>تتبع طلبك</div>
      <div className="space-y-3">
        {TRACKING_STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            {s.done ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
            ) : (
              <Circle className={`w-4 h-4 shrink-0 ${s.active ? 'animate-pulse' : ''}`} style={{ color: s.active ? GOLD : 'rgba(237,228,208,0.3)' }} />
            )}
            <span className="text-xs" style={{ color: s.done || s.active ? CREAM : 'rgba(237,228,208,0.4)' }}>{s.label}</span>
          </div>
        ))}
      </div>
      <Link to="/my-bookings" className="mt-4 flex items-center gap-1 text-xs font-bold" style={{ color: GOLD }}>
        عرض كل التفاصيل
        <ChevronLeft className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

function MiniCalendar() {
  const [selected, setSelected] = useState(2);
  const days = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const today = new Date().getDate();
  const dates = Array.from({ length: 7 }, (_, i) => today + i);
  const slots = ['10:00 ص', '12:30 م', '4:00 م', '6:30 م'];
  const [slot, setSlot] = useState(1);

  return (
    <div className="w-72 sm:w-80">
      <div className="text-sm font-black mb-3" style={{ color: CREAM }}>احجز موعدك</div>
      <div className="grid grid-cols-7 gap-1 mb-3">
        {dates.map((d, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className="flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors"
            style={{
              background: selected === i ? GOLD : 'rgba(237,228,208,0.06)',
              color: selected === i ? '#1c130d' : CREAM,
            }}
          >
            <span className="text-[9px] opacity-70">{days[i % 7]}</span>
            <span className="text-xs font-bold">{d}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {slots.map((s, i) => (
          <button
            key={i}
            onClick={() => setSlot(i)}
            className="text-xs py-2 rounded-lg font-medium transition-colors"
            style={{
              border: `1px solid ${slot === i ? GOLD : 'rgba(237,228,208,0.15)'}`,
              color: slot === i ? GOLD : 'rgba(237,228,208,0.7)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <Link
        to="/book"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-black text-sm"
        style={{ background: `linear-gradient(135deg, ${GOLD}, #a8863c)`, color: '#1c130d' }}
      >
        تأكيد الحجز
        <ChevronLeft className="w-4 h-4" />
      </Link>
    </div>
  );
}

export default function HeroOverlayUI() {
  const openPanel = useHeroStore((s) => s.openPanel);
  const togglePanel = useHeroStore((s) => s.togglePanel);
  const closePanel = useHeroStore((s) => s.closePanel);

  return (
    <div dir="rtl" className="absolute inset-0 pointer-events-none font-tajawal select-none">
      {/* ── العنوان والعلامة التجارية — أعلى الشاشة ── */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute top-8 inset-x-0 flex flex-col items-center gap-1 px-6 text-center"
      >
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight" style={{ color: CREAM, textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
          إبرة وخيط الإسكافي
        </h1>
        <span className="text-xs sm:text-sm tracking-[0.3em]" style={{ color: GOLD }}>
          needlecobbler.com
        </span>
      </motion.div>

      {/* ── أزرار CTA الرئيسية — أسفل الشاشة ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="absolute bottom-24 inset-x-0 flex items-center justify-center gap-3 px-6 pointer-events-auto"
      >
        <a
          href="https://wa.me/966549678191"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold backdrop-blur-md"
          style={{ background: 'rgba(237,228,208,0.08)', border: '1px solid rgba(237,228,208,0.2)', color: CREAM }}
        >
          <MessageCircle className="w-4 h-4" style={{ color: GOLD }} />
          تواصل معنا
        </a>

        <Link
          to="/book"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #a8863c)`, color: '#1c130d', boxShadow: `0 12px 40px rgba(201,168,76,0.35)` }}
        >
          احجز الآن
          <ChevronLeft className="w-4 h-4" />
        </Link>
      </motion.div>

      {/* ── مفاتيح فتح اللوحات الجانبية ── */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 sm:right-8 flex flex-col gap-3 pointer-events-auto">
        <button
          onClick={() => togglePanel('tracking')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold backdrop-blur-md transition-transform hover:scale-105"
          style={{
            background: openPanel === 'tracking' ? GOLD : 'rgba(237,228,208,0.08)',
            border: '1px solid rgba(237,228,208,0.2)',
            color: openPanel === 'tracking' ? '#1c130d' : CREAM,
          }}
        >
          <ChevronRight className="w-3.5 h-3.5" />
          تتبع طلبك
        </button>
        <button
          onClick={() => togglePanel('booking')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold backdrop-blur-md transition-transform hover:scale-105"
          style={{
            background: openPanel === 'booking' ? GOLD : 'rgba(237,228,208,0.08)',
            border: '1px solid rgba(237,228,208,0.2)',
            color: openPanel === 'booking' ? '#1c130d' : CREAM,
          }}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          الحجز السريع
        </button>
      </div>

      {/* ── اللوحة الزجاجية المنبثقة ── */}
      <AnimatePresence>
        {openPanel && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-1/2 -translate-y-1/2 right-20 sm:right-28 pointer-events-auto rounded-2xl p-5 backdrop-blur-xl"
            style={{ background: 'rgba(28,19,13,0.85)', border: '1px solid rgba(237,228,208,0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          >
            <button onClick={closePanel} className="absolute top-3 left-3 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" style={{ color: CREAM }} />
            </button>
            {openPanel === 'tracking' ? <TrackingPanel /> : <MiniCalendar />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── تلميح تمرير ── */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center">
        <span className="text-[10px] tracking-widest" style={{ color: 'rgba(237,228,208,0.35)' }}>
          مرّر للأسفل
        </span>
      </div>
    </div>
  );
}
