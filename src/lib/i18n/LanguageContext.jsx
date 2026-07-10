import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { translations } from './translations';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'cobbler_lang';

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
    const revealTimer = setTimeout(() => {
      setLangState(incomingLang);
    }, 430);
    const endTimer = setTimeout(() => {
      setTransitioning(false);
      setIncomingLang(null);
    }, 980);
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
  const bars = Array.from({ length: 7 });
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
              duration: 0.95,
              delay: i * 0.045,
              times: [0, 0.42, 0.62, 1],
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
