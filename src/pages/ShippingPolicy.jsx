import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Truck, Clock, MapPin, Package, CheckCircle, Phone } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const GOLD = '#C9A84C';
const TEXT = '#F5EDD8';
const STEP_ICONS = [Phone, Truck, Package, CheckCircle];

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-black mb-4 pb-2" style={{ color: GOLD, borderBottom: '1px solid rgba(201,168,76,0.15)' }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,0.6)' }}>{children}</div>
    </div>
  );
}

export default function ShippingPolicy() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const steps = t('shippingPolicy.steps');
  const fees = t('shippingPolicy.fees');
  const trackItems = t('shippingPolicy.trackItems');
  const footer = t('shippingPolicy.footer');

  return (
    <div className="min-h-screen font-tajawal" style={{ background: '#060300', color: TEXT }} dir={dir}>
      <Helmet>
        <title>{isAr ? 'سياسة التوصيل والاستلام | إبرة وخيط الإسكافي' : 'Shipping & Pickup Policy | Ebra & Khait Cobbler'}</title>
        <meta name="description" content={isAr
          ? 'تعرف على سياسة التوصيل والاستلام في إبرة وخيط الإسكافي — نستلم من موقعك ونوصل لبابك داخل الرياض.'
          : 'Learn about our shipping and pickup policy at Ebra & Khait Cobbler — we pick up from your location and deliver to your door in Riyadh.'} />
        <meta name="keywords" content={isAr
          ? 'استلام وتوصيل إصلاح أحذية, توصيل مجاني إصلاح أحذية الرياض, استلام حذاء من المنزل, خدمة توصيل تجديد حقائب جلدية الرياض'
          : 'shoe repair pickup delivery, free shoe repair delivery riyadh, home shoe pickup, leather bag renewal delivery riyadh'} />
        <link rel="canonical" href="https://needlecobbler.com/shipping-policy" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-6"
        style={{ background: 'rgba(6,3,0,0.95)', borderBottom: '1px solid rgba(201,168,76,0.1)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between" dir={dir}>
          <Link to="/" className="text-lg font-black" style={{ color: GOLD }}>{t('common.brand')}</Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/" className="text-sm hover:text-yellow-400 transition-colors" style={{ color: 'rgba(245,237,216,0.5)' }}>{t('common.nav.home')}</Link>
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-6 max-w-4xl mx-auto" dir={dir}>
        <div className="flex items-center gap-3 mb-10">
          <Truck className="w-8 h-8" style={{ color: GOLD }} />
          <div>
            <h1 className="text-3xl font-black" style={{ color: TEXT }}>{t('shippingPolicy.title')}</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(245,237,216,0.3)' }}>{t('shippingPolicy.subtitle')}</p>
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          {steps.map((s, i) => (
            <div key={i} className="p-5 rounded-2xl flex gap-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,0.1)' }}>
                {React.createElement(STEP_ICONS[i], { className: 'w-5 h-5', style: { color: GOLD } })}
              </div>
              <div>
                <h3 className="font-black mb-1" style={{ color: TEXT }}>{i + 1}. {s.title}</h3>
                <p className="text-sm" style={{ color: 'rgba(245,237,216,0.5)' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Section title={t('shippingPolicy.coverageTitle')}>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GOLD }} />
            <div>
              <p><strong style={{ color: TEXT }}>{t('shippingPolicy.coverageInside')}</strong> {t('shippingPolicy.coverageInsideDesc')}</p>
              <p><strong style={{ color: TEXT }}>{t('shippingPolicy.coverageOutside')}</strong> {t('shippingPolicy.coverageOutsideDesc')}</p>
            </div>
          </div>
        </Section>

        <Section title={t('shippingPolicy.timesTitle')}>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GOLD }} />
            <div>
              <p><strong style={{ color: TEXT }}>{t('shippingPolicy.workDays')}</strong> {t('shippingPolicy.workDaysDesc')}</p>
              <p><strong style={{ color: TEXT }}>{t('shippingPolicy.responseTime')}</strong> {t('shippingPolicy.responseTimeDesc')}</p>
              <p><strong style={{ color: TEXT }}>{t('shippingPolicy.completionTime')}</strong> {t('shippingPolicy.completionTimeDesc')}</p>
            </div>
          </div>
        </Section>

        <Section title={t('shippingPolicy.feesTitle')}>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
            {fees.map((r, i) => (
              <div key={i} className="flex justify-between items-center px-5 py-3 text-sm"
                style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                <span style={{ color: 'rgba(245,237,216,0.6)' }}>{r.zone}</span>
                <span className="font-bold" style={{ color: GOLD }}>{r.price}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t('shippingPolicy.trackTitle')}>
          <p>{t('shippingPolicy.trackDesc')}</p>
          <ul className="list-disc list-inside space-y-1 mr-4">
            {trackItems.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </Section>

        <Section title={t('shippingPolicy.contactTitle')}>
          <p>{t('shippingPolicy.contactDesc')}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <a href="https://wa.me/966549678191" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
              style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)' }}>
              WhatsApp: 0549678191
            </a>
          </div>
        </Section>
      </div>

      <footer className="py-6 px-6 border-t text-center text-sm" dir={dir}
        style={{ borderColor: 'rgba(201,168,76,0.08)', color: 'rgba(245,237,216,0.2)', background: '#060300' }}>
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          <Link to="/" className="hover:text-yellow-400 transition-colors">{t('common.nav.home')}</Link>
          <Link to="/about" className="hover:text-yellow-400 transition-colors">{footer.about}</Link>
          <Link to="/privacy" className="hover:text-yellow-400 transition-colors">{footer.privacy}</Link>
          <Link to="/shipping-policy" className="hover:text-yellow-400 transition-colors" style={{ color: GOLD }}>{footer.shipping}</Link>
          <Link to="/repair-policy" className="hover:text-yellow-400 transition-colors">{footer.repair}</Link>
        </div>
        <p>© {new Date().getFullYear()} {t('common.brand')}</p>
      </footer>
    </div>
  );
}
