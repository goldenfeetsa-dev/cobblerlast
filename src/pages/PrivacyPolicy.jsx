import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const GOLD = '#C9A84C';
const TEXT = '#F5EDD8';

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-black mb-4 pb-2" style={{ color: GOLD, borderBottom: '1px solid rgba(201,168,76,0.15)' }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,0.6)' }}>{children}</div>
    </div>
  );
}

export default function PrivacyPolicy() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const sections = t('privacyPolicy.sections');
  const footer = t('privacyPolicy.footer');

  return (
    <div className="min-h-screen font-tajawal" style={{ background: '#060300', color: TEXT }} dir={dir}>
      <Helmet>
        <title>{isAr ? 'سياسة الخصوصية | إبرة وخيط الإسكافي' : 'Privacy Policy | Ebra & Khait Cobbler'}</title>
        <meta name="description" content={isAr
          ? 'سياسة الخصوصية لموقع إبرة وخيط الإسكافي — كيف نتعامل مع بياناتك الشخصية ونحمي خصوصيتك.'
          : 'Privacy Policy for Ebra & Khait Cobbler — how we handle your personal data and protect your privacy.'} />
        <link rel="canonical" href="https://needlecobbler.com/privacy" />
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
          <Shield className="w-8 h-8" style={{ color: GOLD }} />
          <div>
            <h1 className="text-3xl font-black" style={{ color: TEXT }}>{t('privacyPolicy.title')}</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(245,237,216,0.3)' }}>{t('privacyPolicy.lastUpdate')}</p>
          </div>
        </div>

        {sections.map((sec, si) => (
          <Section key={si} title={sec.title}>
            {sec.body && sec.body.map((p, i) => <p key={i}>{p}</p>)}
            {sec.intro && (
              <>
                <p><strong style={{ color: TEXT }}>{sec.intro}</strong></p>
                <ul className="list-disc list-inside space-y-1 mr-4">
                  {sec.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              </>
            )}
            {sec.intro2 && (
              <>
                <p className="mt-3"><strong style={{ color: TEXT }}>{sec.intro2}</strong></p>
                <ul className="list-disc list-inside space-y-1 mr-4">
                  {sec.items2.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              </>
            )}
            {sec.items && !sec.intro && (
              <ul className="list-disc list-inside space-y-1 mr-4">
                {sec.items.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            )}
            {sec.highlight && (
              <p><strong style={{ color: TEXT }}>{sec.highlight}</strong> {sec.highlightDesc}</p>
            )}
            {sec.contactNote && (
              <p>{sec.contactNote} <strong style={{ color: GOLD }}>wa.me/966549678191</strong></p>
            )}
            {sec.whatsappLabel && (
              <>
                <p>{sec.whatsappLabel} <a href="https://wa.me/966549678191" className="hover:text-yellow-400" style={{ color: GOLD }}>+966 54 967 8191</a></p>
                <p>{sec.instagramLabel} <a href="https://instagram.com/ebra.kh8" className="hover:text-yellow-400" style={{ color: GOLD }}>@ebra.kh8</a></p>
              </>
            )}
          </Section>
        ))}
      </div>

      <footer className="py-6 px-6 border-t text-center text-sm" dir={dir}
        style={{ borderColor: 'rgba(201,168,76,0.08)', color: 'rgba(245,237,216,0.2)', background: '#060300' }}>
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          <Link to="/" className="hover:text-yellow-400 transition-colors">{t('common.nav.home')}</Link>
          <Link to="/about" className="hover:text-yellow-400 transition-colors">{footer.about}</Link>
          <Link to="/privacy" className="hover:text-yellow-400 transition-colors" style={{ color: GOLD }}>{footer.privacy}</Link>
          <Link to="/shipping-policy" className="hover:text-yellow-400 transition-colors">{footer.shipping}</Link>
          <Link to="/repair-policy" className="hover:text-yellow-400 transition-colors">{footer.repair}</Link>
        </div>
        <p>© {new Date().getFullYear()} {t('common.brand')}</p>
      </footer>
    </div>
  );
}
