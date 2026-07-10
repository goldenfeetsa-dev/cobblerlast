import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Shield, Clock, CheckCircle, AlertCircle, CreditCard, Package, Scissors, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const GOLD = '#C9A84C';
const BG = '#120A00';
const SECTION_ICONS = [Package, Clock, Shield, CreditCard, AlertCircle];

function PolicyCard({ number, title, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="rounded-2xl p-8"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.12)' }}
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
          <Icon className="w-6 h-6" style={{ color: GOLD }} />
        </div>
        <div>
          <span className="text-xs font-bold tracking-widest" style={{ color: 'rgba(201,168,76,0.5)' }}>0{number}</span>
          <h3 className="text-xl font-black" style={{ color: '#F5EDD8' }}>{title}</h3>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

export default function RepairPolicy() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const BackIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const sections = t('repairPolicy.sections');

  return (
    <div dir={dir} style={{ background: BG, minHeight: '100vh', fontFamily: "'Tajawal', sans-serif" }}>
      <Helmet>
        <title>{isAr ? 'سياسة الإصلاح والضمان | إبرة وخيط الإسكافي — الرياض' : 'Repair & Warranty Policy | Ebra & Khait Cobbler — Riyadh'}</title>
        <meta name="description" content={isAr
          ? 'تعرف على سياسة إصلاح الأحذية والحقائب الجلدية في إبرة وخيط الإسكافي: مدة التسليم، ضمان الجودة لمدة 30 يوماً، طرق الدفع، وشروط الاستلام والتقييم في الرياض.'
          : 'Learn about our shoe and leather bag repair policy: delivery time, 30-day quality guarantee, payment methods, and pickup and assessment terms in Riyadh.'} />
        <meta name="keywords" content={isAr
          ? 'سياسة إصلاح الأحذية, ضمان إصلاح الأحذية, مدة تصليح الحذاء, أسعار إصلاح الأحذية الرياض, ضمان تجديد الحقائب, شروط استلام القطع الجلدية'
          : 'shoe repair policy, shoe repair warranty, shoe repair turnaround time, shoe repair prices riyadh, bag renewal warranty, leather item intake terms'} />
        <link rel="canonical" href="https://needlecobbler.com/repair-policy" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={isAr ? 'سياسة الإصلاح والضمان | إبرة وخيط الإسكافي' : 'Repair & Warranty Policy | Ebra & Khait Cobbler'} />
        <meta property="og:description" content={isAr ? 'الشفافية أولاً — تعرف على سياسة الاستلام، مدة التسليم، وضمان الجودة قبل حجز موعدك.' : 'Transparency first — learn about our intake policy, delivery time, and quality guarantee before booking.'} />
        <meta property="og:url" content="https://needlecobbler.com/repair-policy" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "خدمة إصلاح وترميم الأحذية والحقائب الجلدية",
          "provider": { "@type": "LocalBusiness", "name": "إبرة وخيط الإسكافي", "address": { "@type": "PostalAddress", "addressLocality": "الرياض", "addressCountry": "SA" } },
          "areaServed": "الرياض",
          "termsOfService": "https://needlecobbler.com/repair-policy",
        })}</script>
      </Helmet>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 px-6 h-16 flex items-center justify-between"
        style={{ background: 'rgba(18,10,0,0.95)', borderBottom: '1px solid rgba(201,168,76,0.1)', backdropFilter: 'blur(12px)' }}>
        <Link to="/booking" className="text-xl font-black" style={{ color: GOLD }}>{t('common.brand')}</Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link to="/book">
            <button className="px-5 h-9 rounded-full text-sm font-bold text-black"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)` }}>{t('repairPolicy.bookNow')}</button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-20 px-6 text-center" style={{ background: 'linear-gradient(180deg, #1A0C00 0%, #120A00 100%)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <Link to="/booking" className="inline-flex items-center gap-2 mb-8 text-sm hover:opacity-80 transition-opacity"
            style={{ color: 'rgba(245,237,216,0.4)' }}>
            <BackIcon className="w-4 h-4" />{t('repairPolicy.backHome')}
          </Link>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: GOLD }}>
            <Shield className="w-3 h-3" />{t('repairPolicy.badge')}
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4" style={{ color: '#F5EDD8' }}>
            {t('repairPolicy.title')}
          </h1>
          <p className="text-base max-w-xl mx-auto" style={{ color: 'rgba(245,237,216,0.4)' }}>
            {t('repairPolicy.subtitle')}
          </p>
        </motion.div>
      </div>

      {/* Policy Sections */}
      <div className="max-w-4xl mx-auto px-6 pb-24 space-y-6">

        {sections.map((sec, si) => (
          <PolicyCard key={si} number={si + 1} title={sec.title} icon={SECTION_ICONS[si]}>
            {sec.items && (
              <ul className="space-y-3">
                {sec.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(245,237,216,0.6)' }}>
                    {si === 4
                      ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                      : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />}
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {sec.durations && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  {sec.durations.map((d, i) => (
                    <div key={i} className="rounded-xl p-4 text-center"
                      style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.1)' }}>
                      <div className="text-2xl font-black mb-1" style={{ color: GOLD }}>{d.time}</div>
                      <div className="text-xs" style={{ color: 'rgba(245,237,216,0.4)' }}>{d.type}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'rgba(245,237,216,0.35)' }}>{sec.note}</p>
              </>
            )}
            {sec.methods && (
              <div className="flex flex-wrap gap-2">
                {sec.methods.map(m => (
                  <span key={m} className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: GOLD }}>{m}</span>
                ))}
              </div>
            )}
          </PolicyCard>
        ))}

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-2xl p-10 text-center mt-8"
          style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))', border: '1px solid rgba(201,168,76,0.2)' }}>
          <Scissors className="w-10 h-10 mx-auto mb-4" style={{ color: GOLD }} />
          <h3 className="text-2xl font-black mb-3" style={{ color: '#F5EDD8' }}>{t('repairPolicy.ctaTitle')}</h3>
          <p className="text-sm mb-6" style={{ color: 'rgba(245,237,216,0.4)' }}>{t('repairPolicy.ctaDesc')}</p>
          <Link to="/book">
            <button className="px-10 py-3.5 rounded-full font-black text-base text-black hover:scale-105 transition-all"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)`, boxShadow: '0 8px 30px rgba(201,168,76,0.3)' }}>
              {t('repairPolicy.ctaBtn')}
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
