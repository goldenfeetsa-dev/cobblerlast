import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { translations } from './translations';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'cobbler_lang';

// ── تلاشي سريع بديل عن الستارة الكاملة (كانت ~1.25 ثانية، صارت
// أقل من نص ثانية) — نفس فكرة "التغطية ثم الكشف" بس بسيط وأسرع
const FADE_DURATION_MS = 220;
const FADE_HOLD_MS = 90; // مدة التغطية الكاملة قبل ما يبدأ يكشف (يخفي تبديل النصوص)
const CURTAIN_FULL_COVER_AT_MS = FADE_DURATION_MS + FADE_HOLD_MS / 2;
const CURTAIN_TOTAL_MS = FADE_DURATION_MS * 2 + FADE_HOLD_MS;

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
  return (
    <motion.div
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0A0500, #1A0F00)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{
        duration: (FADE_DURATION_MS * 2 + FADE_HOLD_MS) / 1000,
        times: [0, FADE_DURATION_MS / (FADE_DURATION_MS * 2 + FADE_HOLD_MS), (FADE_DURATION_MS + FADE_HOLD_MS) / (FADE_DURATION_MS * 2 + FADE_HOLD_MS), 1],
        ease: 'easeInOut',
      }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
    >
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.85, 1, 1, 0.9] }}
        transition={{ duration: (FADE_DURATION_MS * 2 + FADE_HOLD_MS) / 1000, ease: 'easeInOut' }}
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
          <Globe className="w-8 h-8 text-black" />
        </div>
        <span className="text-2xl font-black tracking-widest" style={{ color: '#F5EDD8' }}>
          {targetLang === 'en' ? 'EN' : 'ع'}
        </span>
      </motion.div>
    </motion.div>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
