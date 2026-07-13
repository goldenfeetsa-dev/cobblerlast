import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { translations } from './translations';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'cobbler_lang';

// ── توقيت ستارة الانتقال — مرتبط رياضياً بين JS والأنيميشن بالأسفل ──
// كل عمود: مدته BAR_DURATION_MS، ويبدأ إغلاقه فوراً ويكتمل عند
// BAR_CLOSE_FRAC، ويبدأ يفتح عند BAR_OPEN_FRAC، وينتهي عند 1.
// كل عمود متأخر عن الثاني بمقدار BAR_STAGGER_MS.
const BARS_COUNT = 7;
const BAR_DURATION_MS = 950;
const BAR_STAGGER_MS = 40;
const BAR_CLOSE_FRAC = 0.35; // نسبة اكتمال الإغلاق من مدة العمود
const BAR_OPEN_FRAC = 0.78;  // نسبة بداية الفتح من مدة العمود

// لحظة اكتمال تغطية كل الأعمدة معاً (آخر عمود يكمل إغلاقه)
const CURTAIN_ALL_CLOSED_MS = (BARS_COUNT - 1) * BAR_STAGGER_MS + BAR_CLOSE_FRAC * BAR_DURATION_MS;
// لحظة أول عمود يبدأ يفتح (نهاية نافذة التغطية الكاملة)
const CURTAIN_FIRST_OPENS_MS = BAR_OPEN_FRAC * BAR_DURATION_MS;
// نغيّر المحتوى في منتصف نافذة التغطية الكاملة (هامش أمان بالطرفين)
const CURTAIN_FULL_COVER_AT_MS = Math.round((CURTAIN_ALL_CLOSED_MS + CURTAIN_FIRST_OPENS_MS) / 2);
// نهاية الأنيميشن بالكامل (آخر عمود ينتهي فتحه)
const CURTAIN_TOTAL_MS = (BARS_COUNT - 1) * BAR_STAGGER_MS + BAR_DURATION_MS + 60;

function getInitialLang() {
  if (typeof window === 'undefined') return 'ar';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch { /* ignore */ }
  return 'ar';
}

function getByPath(obj, path) {
  let node = obj;
  for (const key of path.split('.')) {
    if (node == null) return undefined;
    node = node[key];
  }
  return node;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang);
  const [transitioning, setTransitioning] = useState(false);
  const [incomingLang, setIncomingLang] = useState(null);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = dir;
  }, [lang, dir]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (next !== 'ar' && next !== 'en') return;
    setIncomingLang(prev => {
      if (prev) return prev; // انتقال يعمل مسبقاً
      return next;
    });
  }, []);

  useEffect(() => {
    if (!incomingLang) return;
    setTransitioning(true);
    // مهم: هذا التوقيت مربوط رياضياً بتوقيت الأعمدة بالأسفل (CURTAIN_*).
    // لازم setLangState يصير بالضبط لما الشاشة مغطاة بالكامل، وإلا
    // تشوف الصفحة القديمة/الجديدة "تومض" من بين فجوات الأعمدة.
    const revealTimer = setTimeout(() => {
      setLangState(incomingLang);
    }, CURTAIN_FULL_COVER_AT_MS);
    const endTimer = setTimeout(() => {
      setTransitioning(false);
      setIncomingLang(null);
    }, CURTAIN_TOTAL_MS);
    return () => { clearTimeout(revealTimer); clearTimeout(endTimer); };
  }, [incomingLang]);

  const toggleLang = useCallback(() => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  }, [lang, setLang]);

  const t = useCallback((path, fallback) => {
    const value = getByPath(translations[lang], path);
    if (value !== undefined) return value;
    const arValue = getByPath(translations.ar, path);
    if (arValue !== undefined) return arValue;
    return fallback !== undefined ? fallback : path;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, dir, setLang, toggleLang, t }}>
      {children}
      <AnimatePresence>
        {transitioning && <LanguageTransitionCurtain targetLang={incomingLang} />}
      </AnimatePresence>
    </LanguageContext.Provider>
  );
}

// ── ستارة الانتقال الذهبية بين اللغتين ──────────────────────────────
function LanguageTransitionCurtain({ targetLang }) {
  const bars = Array.from({ length: BARS_COUNT });
  return (
    <motion.div
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
      style={{ direction: 'ltr' }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <div className="absolute inset-0 flex">
        {bars.map((_, i) => (
          <motion.div
            key={i}
            className="h-full"
            style={{
              flex: 1,
              background: i % 2 === 0
                ? 'linear-gradient(180deg, #0A0500, #1A0F00)'
                : 'linear-gradient(180deg, #C9A84C, #8a6d2a)',
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 1, 1, 0] }}
            transition={{
              duration: BAR_DURATION_MS / 1000,
              delay: i * (BAR_STAGGER_MS / 1000),
              times: [0, BAR_CLOSE_FRAC, BAR_OPEN_FRAC, 1],
              ease: [0.76, 0, 0.24, 1],
            }}
          />
        ))}
      </div>
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1, 0.6], rotate: [-20, 0, 0, 20] }}
        transition={{ duration: 0.95, times: [0, 0.4, 0.65, 1], ease: 'easeInOut' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
            <Globe className="w-8 h-8 text-black" />
          </div>
          <span className="text-2xl font-black tracking-widest" style={{ color: '#F5EDD8' }}>
            {targetLang === 'en' ? 'EN' : 'ع'}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
