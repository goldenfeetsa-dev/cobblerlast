import React, { useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Package, Wrench, CheckCircle2, Home, XCircle, Search, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// نفس هوية الصفحة الرئيسية الفاخرة (بني شوكولاتة + ذهبي مطفي)
const T   = '#3E2723';
const G   = '#C5A059';
const GT  = '#7A5F2E';
const GL  = '#D9BE86';
const GB  = 'rgba(197,160,89,';
const BG1 = '#F9F7F2';

const STEPS = [
  { key: 'pending',     icon: Package },
  { key: 'in_progress', icon: Wrench },
  { key: 'ready',       icon: CheckCircle2 },
  { key: 'completed',   icon: Home },
];

// ── توهج خلفي متحرك — نفس أسلوب الصفحة الرئيسية بالضبط ──────────
function GlowOrb({ x, y, size, color, blur = 120, delay = 0 }) {
  return (
    <motion.div className="absolute pointer-events-none rounded-full"
      style={{ left: x, top: y, width: size, height: size, background: color, filter: `blur(${blur}px)`, transform: 'translate(-50%,-50%)' }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.6, 0.35] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay }} />
  );
}

function FadeIn({ children, delay = 0, className = '', y = 24 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

function Stepper({ status, labels }) {
  if (status === 'cancelled') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 rounded-2xl p-5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
        <XCircle className="w-8 h-8 text-red-500 shrink-0" />
        <p className="font-bold text-red-600">{labels.cancelled}</p>
      </motion.div>
    );
  }

  const currentIdx = STEPS.findIndex(s => s.key === status);
  const idx = currentIdx === -1 ? 0 : currentIdx;
  const isRTL = document.documentElement.dir === 'rtl';

  return (
    <div className="flex items-start justify-between relative py-4">
      <div className="absolute top-[38px] left-0 right-0 h-1.5 rounded-full overflow-hidden" style={{ background: GB + '0.12)' }}>
        <motion.div
          className="h-full rounded-full relative overflow-hidden"
          style={{ background: `linear-gradient(90deg, ${G}, ${GL}, ${GT})`, [isRTL ? 'marginRight' : 'marginLeft']: 'auto' }}
          initial={{ width: '0%' }}
          animate={{ width: `${(idx / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        >
          {/* لمعة متحركة فوق شريط التقدم — إحساس "فاخر" حي */}
          <motion.div
            className="absolute inset-y-0 w-8"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
            animate={{ x: ['-40px', '160px'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
        </motion.div>
      </div>
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i <= idx;
        const active = i === idx;
        return (
          <div key={step.key} className="relative z-10 flex flex-col items-center gap-2" style={{ flex: 1 }}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 260, damping: 18 }}
              className="relative"
            >
              {active && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: G }}
                  animate={{ scale: [1, 1.7, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <div
                className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                style={{
                  background: done ? `linear-gradient(135deg, ${G}, ${GT})` : '#fff',
                  border: done ? 'none' : `2px solid ${GB}0.25)`,
                  boxShadow: active ? `0 0 0 4px ${GB}0.15), 0 8px 20px ${GB}0.3)` : (done ? `0 6px 16px ${GB}0.25)` : 'none'),
                }}
              >
                <Icon className="w-5 h-5" style={{ color: done ? '#000' : GB + '0.5)' }} />
              </div>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.12 }}
              className="text-[11px] font-bold text-center leading-tight" style={{ color: done ? T : '#9c9c9c', maxWidth: '84px' }}
            >
              {labels[step.key]}
            </motion.p>
          </div>
        );
      })}
    </div>
  );
}

export default function TrackItem() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const STATUS = t('home.track.status');

  const [code, setCode] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const search = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/public/site-data?code=${encodeURIComponent(code.trim())}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'server_error');
      setResults(json.results || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  return (
    <div dir={dir} style={{ background: BG1, minHeight: '100vh', fontFamily: "'Tajawal', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <Helmet>
        <title>{t('home.track.title')} | إبرة وخيط الإسكافي</title>
        <meta name="description" content={t('home.track.desc')} />
      </Helmet>

      {/* توهج خلفي زخرفي — يعطي إحساس عمق وفخامة بدل خلفية مسطحة */}
      <GlowOrb x="10%" y="8%" size={280} color={GB + '0.18)'} blur={100} />
      <GlowOrb x="90%" y="30%" size={220} color={GB + '0.14)'} blur={90} delay={2} />
      <GlowOrb x="15%" y="85%" size={260} color={GB + '0.1)'} blur={110} delay={4} />

      <div className="max-w-2xl mx-auto px-6 py-10 relative" style={{ zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-bold transition-transform hover:-translate-x-0.5" style={{ color: GT }}>
            <BackIcon className="w-4 h-4" />
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <LanguageSwitcher />
        </motion.div>

        <FadeIn className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: GT }}>
            <Sparkles className="w-3.5 h-3.5" />
            {t('home.track.eyebrow')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-black mb-3" style={{ color: T }}>{t('home.track.title')}</h1>
          <p className="text-sm" style={{ color: '#6E5C4E' }}>{t('home.track.desc')}</p>
        </FadeIn>

        <FadeIn delay={0.15} className="flex gap-3 mb-8">
          <motion.div
            className="flex-1 rounded-2xl"
            animate={{ boxShadow: focused ? `0 0 0 3px ${GB}0.25), 0 8px 24px ${GB}0.2)` : '0 2px 8px rgba(0,0,0,0.04)' }}
            transition={{ duration: 0.25 }}
          >
            <input
              value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              placeholder={t('home.track.placeholder')} dir="ltr"
              className="w-full px-5 py-4 rounded-2xl outline-none text-base font-bold"
              style={{ background: '#fff', border: `1px solid ${GB}0.2)`, color: T }}
            />
          </motion.div>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
            onClick={search} disabled={loading}
            className="px-7 py-4 rounded-2xl font-black text-sm shadow-md disabled:opacity-60 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${G}, ${GT})`, color: '#000' }}
          >
            {loading ? <Search className="w-5 h-5 animate-pulse" /> : t('home.track.search')}
          </motion.button>
        </FadeIn>

        <AnimatePresence mode="wait">
          {results !== null && (
            results.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-6 text-center text-sm font-bold"
                style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', color: '#b91c1c' }}>
                {t('home.track.notFound')}
              </motion.div>
            ) : (
              <div className="space-y-5">
                {results.map((r, i) => (
                  <motion.div key={r.order_number || i}
                    initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -3 }}
                    className="rounded-3xl p-6 transition-shadow"
                    style={{ background: '#fff', border: `1px solid ${GB}0.18)`, boxShadow: `0 10px 30px ${GB}0.1)` }}>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="font-display text-xl font-black" style={{ color: T }}>{r.order_number}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#8A7969' }}>{t('home.track.customer')}: {r.customer_name}</p>
                      </div>
                      {r.status !== 'cancelled' && (
                        <motion.span
                          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}
                          className="text-xs font-black px-3 py-1.5 rounded-full"
                          style={{ background: GB + '0.1)', color: GT, border: `1px solid ${GB}0.2)` }}>
                          {STATUS[r.status] || r.status}
                        </motion.span>
                      )}
                    </div>
                    <Stepper status={r.status} labels={STATUS} />
                  </motion.div>
                ))}
              </div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
