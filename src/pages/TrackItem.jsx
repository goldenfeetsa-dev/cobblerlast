import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Wrench, CheckCircle2, Home, XCircle, Search, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// نفس هوية الصفحة الرئيسية الفاخرة (بني شوكولاتة + ذهبي مطفي)
const T   = '#3E2723';
const G   = '#C5A059';
const GT  = '#7A5F2E';
const GB  = 'rgba(197,160,89,';
const BG1 = '#F9F7F2';

const STEPS = [
  { key: 'pending',     icon: Package },
  { key: 'in_progress', icon: Wrench },
  { key: 'ready',       icon: CheckCircle2 },
  { key: 'completed',   icon: Home },
];

function Stepper({ status, labels }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 rounded-2xl p-5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
        <XCircle className="w-8 h-8 text-red-500 shrink-0" />
        <p className="font-bold text-red-600">{labels.cancelled}</p>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex(s => s.key === status);
  const idx = currentIdx === -1 ? 0 : currentIdx;

  return (
    <div className="flex items-start justify-between relative py-4">
      {/* خط التقدم الخلفي */}
      <div className="absolute top-[38px] left-0 right-0 h-1 rounded-full" style={{ background: GB + '0.15)' }} />
      <motion.div
        className="absolute top-[38px] h-1 rounded-full"
        style={{ background: `linear-gradient(90deg, ${G}, ${GT})`, [document.documentElement.dir === 'rtl' ? 'right' : 'left']: 0 }}
        initial={{ width: 0 }}
        animate={{ width: `${(idx / (STEPS.length - 1)) * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i <= idx;
        return (
          <div key={step.key} className="relative z-10 flex flex-col items-center gap-2" style={{ flex: 1 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="w-11 h-11 rounded-full flex items-center justify-center shadow-md"
              style={{
                background: done ? `linear-gradient(135deg, ${G}, ${GT})` : '#fff',
                border: done ? 'none' : `2px solid ${GB}0.25)`,
              }}
            >
              <Icon className="w-5 h-5" style={{ color: done ? '#000' : GB + '0.5)' }} />
            </motion.div>
            <p className="text-[11px] font-bold text-center leading-tight" style={{ color: done ? T : '#9c9c9c', maxWidth: '80px' }}>
              {labels[step.key]}
            </p>
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
    <div dir={dir} style={{ background: BG1, minHeight: '100vh', fontFamily: "'Tajawal', sans-serif" }}>
      <Helmet>
        <title>{t('home.track.title')} | إبرة وخيط الإسكافي</title>
        <meta name="description" content={t('home.track.desc')} />
      </Helmet>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-bold" style={{ color: GT }}>
            <BackIcon className="w-4 h-4" />
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: GT }}>{t('home.track.eyebrow')}</p>
          <h1 className="font-display text-4xl md:text-5xl font-black mb-3" style={{ color: T }}>{t('home.track.title')}</h1>
          <p className="text-sm" style={{ color: '#6E5C4E' }}>{t('home.track.desc')}</p>
        </div>

        <div className="flex gap-3 mb-8">
          <input
            value={code} onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder={t('home.track.placeholder')} dir="ltr"
            className="flex-1 px-5 py-4 rounded-2xl outline-none text-base font-bold shadow-sm"
            style={{ background: '#fff', border: `1px solid ${GB}0.2)`, color: T }}
          />
          <button
            onClick={search} disabled={loading}
            className="px-7 py-4 rounded-2xl font-black text-sm shadow-md disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${G}, ${GT})`, color: '#000' }}
          >
            {loading ? <Search className="w-5 h-5 animate-pulse" /> : t('home.track.search')}
          </button>
        </div>

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
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-3xl p-6 shadow-md"
                    style={{ background: '#fff', border: `1px solid ${GB}0.15)` }}>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="font-display text-xl font-black" style={{ color: T }}>{r.order_number}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#8A7969' }}>{t('home.track.customer')}: {r.customer_name}</p>
                      </div>
                      {r.status !== 'cancelled' && (
                        <span className="text-xs font-black px-3 py-1.5 rounded-full" style={{ background: GB + '0.1)', color: GT }}>
                          {STATUS[r.status] || r.status}
                        </span>
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
