import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// زر تبديل اللغة — يظهر في أعلى شريط التنقل بكل صفحة عامة
export default function LanguageSwitcher({ className = '', dark = true }) {
  const { lang, toggleLang } = useLanguage();
  const gold = '#C9A84C';

  return (
    <motion.button
      type="button"
      onClick={toggleLang}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black shrink-0 ${className}`}
      style={{
        border: `1px solid ${dark ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.5)'}`,
        background: dark ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.12)',
        color: gold,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={lang}
          initial={{ rotate: -180, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 180, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-1.5"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'EN' : 'ع'}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
