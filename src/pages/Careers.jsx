import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { MapPin, ArrowLeft, ArrowRight } from 'lucide-react';
import { INK, HAIR, SITE, EMP, ABOUT, jobTitle, LogoBar } from '@/components/careers/careersCommon';

export default function Careers() {
  useTrackVisit('/careers');
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const prefix = isAr ? '' : '/en';
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const about = ABOUT[isAr ? 'ar' : 'en'];

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-job-postings'],
    queryFn: () => db.JobPosting.filter({ is_active: true }, '-created_at', 100),
  });

  const title = isAr ? 'وظائف إبرة وخيط الإسكافي | انضم لفريق ترميم الأحذية والحقائب في الرياض' : "Careers at Ebra & Khait Cobbler | Join Riyadh's Luxury Leather Repair Team";
  const desc = isAr
    ? 'وظائف شاغرة في إبرة وخيط الإسكافي بالرياض: فنيو إصلاح أحذية وحقائب جلدية فاخرة. تعرّف على المهام وقدّم بسيرتك الذاتية مباشرة.'
    : 'Open positions at Ebra & Khait Cobbler in Riyadh: luxury shoe and leather bag repair technicians. See the duties and apply directly with your CV.';
  const url = `${SITE}${prefix}/careers`;

  return (
    <div className="min-h-screen" style={{ background: '#0b0b0c', color: INK }} dir={isAr ? 'rtl' : 'ltr'}>
      <Helmet>
        <html lang={isAr ? 'ar' : 'en'} dir={isAr ? 'rtl' : 'ltr'} />
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <link rel="alternate" hrefLang="ar" href={`${SITE}/careers`} />
        <link rel="alternate" hrefLang="en" href={`${SITE}/en/careers`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE}/careers`} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        {jobs.length > 0 && (
          <script type="application/ld+json">{JSON.stringify({
            '@context': 'https://schema.org', '@type': 'ItemList', name: title,
            itemListElement: jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}${prefix}/careers/${j.slug}`, name: jobTitle(j, isAr) })),
          })}</script>
        )}
      </Helmet>

      <LogoBar isAr={isAr} prefix={prefix} />

      <section className="max-w-3xl mx-auto px-5 pt-14 pb-12 text-center">
        <p className="text-xs tracking-[0.35em] uppercase mb-4" style={{ color: '#8d8a82' }}>{isAr ? 'الوظائف' : 'Careers'}</p>
        <h1 className="text-3xl sm:text-5xl font-light leading-tight mb-5">{isAr ? 'اصنع معنا أثراً في كل قطعة' : 'Craft something lasting with us'}</h1>
        <p className="font-light leading-loose max-w-xl mx-auto" style={{ color: '#a8a398' }}>{about.p}</p>
      </section>

      <section className="max-w-3xl mx-auto px-5 pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px" style={{ background: HAIR }}>
          {about.values.map((v) => <div key={v} className="py-5 px-3 text-center text-sm" style={{ background: '#0b0b0c', color: '#bdb8ad' }}>{v}</div>)}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-12">
        <h2 className="text-xl font-light mb-6 tracking-wide">{isAr ? 'الوظائف المتاحة' : 'Open positions'}</h2>
        {isLoading ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 animate-pulse" style={{ background: 'rgba(255,255,255,.05)' }} />)}</div>
        ) : jobs.length === 0 ? (
          <p className="text-center py-14" style={{ color: '#8d8a82' }}>{isAr ? 'لا توجد وظائف شاغرة حالياً — نرحب بمتابعتنا لأي جديد.' : 'No open positions right now — please check back soon.'}</p>
        ) : (
          <div className="space-y-px" style={{ background: HAIR }}>
            {jobs.map((j) => (
              <Link key={j.id} to={`${prefix}/careers/${j.slug}`} className="flex items-center justify-between gap-4 p-6 transition-colors hover:bg-white/5" style={{ background: '#0b0b0c' }}>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">{jobTitle(j, isAr)}</h3>
                  <div className="flex items-center gap-4 text-sm mt-1.5 flex-wrap" style={{ color: '#8d8a82' }}>
                    <span>{EMP[isAr ? 'ar' : 'en'][j.employment_type]}</span>
                    {j.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{j.location}</span>}
                  </div>
                </div>
                <Arrow className="w-5 h-5 shrink-0" style={{ color: '#8d8a82' }} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
