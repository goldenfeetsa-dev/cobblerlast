import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle2, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { SERVICE_PAGES, serviceBySlug } from '@/lib/seo/services';
import PageNotFound from '@/lib/PageNotFound';

const T = '#3E2723', GT = '#7A5F2E', G = '#C5A059', GB = 'rgba(197,160,89,';

/** صفحة خدمة تفصيلية (هبوط لنية بحث محددة) — المحتوى من src/lib/seo/services.js
 *  وهو نفس المصدر اللي يبني الـHTML الثابت للزواحف وقت البناء. */
export default function ServicePage() {
  const { slug } = useParams();
  const { lang, dir, t } = useLanguage();
  const isAr = lang === 'ar';
  const svc = serviceBySlug(slug);
  if (!svc) return <PageNotFound />;
  const c = svc[isAr ? 'ar' : 'en'];
  const pre = isAr ? '' : '/en';
  const Back = isAr ? ArrowRight : ArrowLeft;
  const steps = t('home.services.steps');
  const others = SERVICE_PAGES.filter((s) => s.slug !== slug);

  return (
    <div dir={dir} style={{ background: '#f6efe4', minHeight: '100vh', fontFamily: "'Almarai', sans-serif", color: T }}>
      <Helmet>
        <title>{c.title}</title>
        <meta name="description" content={c.description} />
      </Helmet>

      <header className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to={pre || '/'} className="flex items-center gap-1.5 text-sm font-bold" style={{ color: GT }}>
          <Back className="w-4 h-4" /> {isAr ? 'الرئيسية' : 'Home'}
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-20">
        <nav aria-label="breadcrumb" className="text-xs mb-4" style={{ color: GT }}>
          <Link to={pre || '/'}>{isAr ? 'الرئيسية' : 'Home'}</Link> / <span>{c.name}</span>
        </nav>
        <h1 className="font-display text-3xl md:text-4xl font-black leading-snug mb-5">{c.h1}</h1>
        <p className="text-base leading-8 mb-8" style={{ color: '#4a382c' }}>{c.intro}</p>

        <h2 className="text-xl font-black mb-4">{isAr ? 'ماذا نصلح ونجدد' : 'What we repair'}</h2>
        <ul className="grid sm:grid-cols-2 gap-3 mb-8">
          {c.covers.map((x) => (
            <li key={x} className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#fff', border: `1px solid ${GB}0.25)` }}>
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GT }} /> {x}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-7 mb-10 rounded-xl px-4 py-3" style={{ background: `${GB}0.12)` }}>{c.extra}</p>

        {Array.isArray(steps) && (
          <>
            <h2 className="text-xl font-black mb-4">{t('home.services.howItWorksTitle')}</h2>
            <ol className="space-y-3 mb-10">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm leading-7">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ background: G, color: '#000' }}>{i + 1}</span>
                  <span><strong>{s.t}:</strong> {s.d}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        <h2 className="text-xl font-black mb-4">{isAr ? 'أسئلة شائعة' : 'FAQ'}</h2>
        <div className="space-y-3 mb-12">
          {c.faq.map((f) => (
            <details key={f.q} className="rounded-2xl px-5 py-4" style={{ background: '#fff', border: `1px solid ${GB}0.2)` }}>
              <summary className="font-bold cursor-pointer"><h3 className="inline text-base">{f.q}</h3></summary>
              <p className="mt-3 text-sm leading-7" style={{ color: '#5a4636' }}>{f.a}</p>
            </details>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-14">
          <Link to={`${pre}/book`} className="px-6 py-3 rounded-full font-black text-sm" style={{ background: G, color: '#000' }}>
            {isAr ? 'احجز موعدك' : 'Book your repair'}
          </Link>
          <a href="https://wa.me/966549678191" className="px-6 py-3 rounded-full font-black text-sm flex items-center gap-2" style={{ border: `1px solid ${G}`, color: GT }}>
            <MessageCircle className="w-4 h-4" /> {isAr ? 'تواصل واتساب' : 'WhatsApp us'}
          </a>
        </div>

        <h2 className="text-lg font-black mb-3">{isAr ? 'خدمات أخرى' : 'Other services'}</h2>
        <ul className="flex flex-wrap gap-2">
          {others.map((s) => (
            <li key={s.slug}>
              <Link to={`${pre}/services/${s.slug}`} className="inline-block rounded-full px-4 py-2 text-xs font-bold" style={{ background: '#fff', border: `1px solid ${GB}0.3)` }}>
                {s[isAr ? 'ar' : 'en'].name}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
