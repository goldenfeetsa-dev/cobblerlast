import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, ChevronDown, ChevronUp, CheckCircle2, Circle, ChevronLeft,
} from 'lucide-react';
import { useHeroStore } from '@/lib/hero3d/store';

const GOLD = '#C9A84C';
const CREAM = '#EDE4D0';

const TRACKING_STEPS = [
  { label: 'ترميم الجلد', done: true },
  { label: 'تغيير النعل', done: true },
  { label: 'تغيير الحشو', done: false, active: true },
  { label: 'تغيير الجلدة', done: false },
  { label: 'سحب البيتر', done: false },
];

// ── شريط تقدّم بسيط: استلام -> تسليم، مع نقطة متوهجة تتحرك ──
function ProgressTrack() {
  return (
    <div className="relative flex items-center justify-between mt-4 mb-1">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px" style={{ background: 'rgba(237,228,208,0.15)' }} />
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        style={{ background: GOLD, boxShadow: `0 0 12px 3px ${GOLD}` }}
        animate={{ left: ['4%', '96%', '4%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="flex flex-col items-center gap-1 z-10">
        <div className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
        <span className="text-[10px]" style={{ color: 'rgba(237,228,208,0.55)' }}>استلام</span>
      </div>
      <div className="flex flex-col items-center gap-1 z-10">
        <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(237,228,208,0.25)' }} />
        <span className="text-[10px]" style={{ color: 'rgba(237,228,208,0.55)' }}>تسليم</span>
      </div>
    </div>
  );
}

function TrackingPanel() {
  const open = useHeroStore((s) => s.trackingOpen);
  const toggle = useHeroStore((s) => s.toggleTracking);

  return (
    <div
      className="w-64 sm:w-72 rounded-2xl p-4 backdrop-blur-xl pointer-events-auto"
      style={{ background: 'rgba(28,19,13,0.72)', border: '1px solid rgba(237,228,208,0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}
    >
      <button onClick={toggle} className="flex items-center justify-between w-full">
        <span className="text-sm font-black" style={{ color: CREAM }}>تتبع طلبك</span>
        {open ? <ChevronUp className="w-4 h-4" style={{ color: GOLD }} /> : <ChevronDown className="w-4 h-4" style={{ color: GOLD }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 mt-3">
              {TRACKING_STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {s.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />
                  ) : (
                    <Circle className={`w-3.5 h-3.5 shrink-0 ${s.active ? 'animate-pulse' : ''}`} style={{ color: s.active ? GOLD : 'rgba(237,228,208,0.3)' }} />
                  )}
                  <span className="text-xs" style={{ color: s.done || s.active ? CREAM : 'rgba(237,228,208,0.4)' }}>{s.label}</span>
                </div>
              ))}
            </div>
            <ProgressTrack />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BookingPanel() {
  const open = useHeroStore((s) => s.bookingOpen);
  const toggle = useHeroStore((s) => s.toggleBooking);
  const [selected, setSelected] = useState(2);
  const days = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const today = new Date().getDate();
  const dates = Array.from({ length: 5 }, (_, i) => today + i);

  return (
    <div
      className="w-64 sm:w-72 rounded-2xl p-4 backdrop-blur-xl pointer-events-auto"
      style={{ background: 'rgba(28,19,13,0.72)', border: '1px solid rgba(237,228,208,0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}
    >
      <button onClick={toggle} className="flex items-center justify-between w-full">
        <span className="text-sm font-black" style={{ color: CREAM }}>الحجز</span>
        {open ? <ChevronUp className="w-4 h-4" style={{ color: GOLD }} /> : <ChevronDown className="w-4 h-4" style={{ color: GOLD }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-5 gap-1.5 mt-3 mb-3">
              {dates.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className="flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors"
                  style={{ background: selected === i ? GOLD : 'rgba(237,228,208,0.06)', color: selected === i ? '#1c130d' : CREAM }}
                >
                  <span className="text-[9px] opacity-70">{days[i % 7]}</span>
                  <span className="text-xs font-bold">{d}</span>
                </button>
              ))}
            </div>
            <Link
              to="/book"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl font-black text-xs"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #a8863c)`, color: '#1c130d' }}
            >
              تأكيد الحجز
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HeroOverlayUI() {
  return (
    <div dir="rtl" className="absolute inset-0 pointer-events-none font-tajawal select-none">
      {/* ── العنوان + تواصل معنا — أعلى الشاشة ── */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute top-6 sm:top-8 inset-x-0 flex flex-col items-center gap-3 px-6 text-center"
      >
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight" style={{ color: CREAM, textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
            موقع إبرة وخيط الإسكافي
          </h1>
          <span className="text-[11px] sm:text-sm tracking-[0.25em]" style={{ color: GOLD }}>
            thecobblersneedle.com
          </span>
        </div>

        <a
          href="https://wa.me/966549678191"
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold backdrop-blur-md"
          style={{ background: 'rgba(237,228,208,0.08)', border: '1px solid rgba(237,228,208,0.2)', color: CREAM }}
        >
          <MessageCircle className="w-4 h-4" style={{ color: GOLD }} />
          تواصل معنا
        </a>
      </motion.div>

      {/* ── احجز الآن — منتصف الشاشة تقريباً، فوق المكتب ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="absolute top-[58%] inset-x-0 flex justify-center pointer-events-auto"
      >
        <Link
          to="/book"
          className="flex items-center gap-2 px-7 py-3 rounded-2xl text-sm font-black"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #a8863c)`, color: '#1c130d', boxShadow: `0 12px 40px rgba(201,168,76,0.4)` }}
        >
          احجز الآن
          <ChevronLeft className="w-4 h-4" />
        </Link>
      </motion.div>

      {/* ── لوحة تتبع الطلب — يمين الشاشة، ثابتة وظاهرة افتراضياً ── */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.35 }}
        className="absolute top-[38%] -translate-y-1/2 right-3 sm:right-6"
      >
        <TrackingPanel />
      </motion.div>

      {/* ── لوحة الحجز السريع — أسفل يسار الشاشة، ثابتة وظاهرة افتراضياً ── */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.45 }}
        className="absolute bottom-6 left-3 sm:left-6"
      >
        <BookingPanel />
      </motion.div>
    </div>
  );
}
