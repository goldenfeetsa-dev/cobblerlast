import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { MapPin, Clock } from 'lucide-react';
import { INK, HAIR, SITE, EMP, SCHEMA_EMP, ABOUT, jobTitle, jobTasks, LogoBar } from '@/components/careers/careersCommon';
import ApplyForm from '@/components/careers/ApplyForm';

export default function CareerDetail() {
  const { slug } = useParams();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const prefix = isAr ? '' : '/en';
  useTrackVisit(`/careers/${slug}`);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['public-job-postings'],
    queryFn: () => db.JobPosting.filter({ is_active: true }, '-created_at', 100),
  });
  const job = jobs?.find((j) => j.slug === slug);

  if (!isLoading && jobs && !job) return <Navigate to={`${prefix}/careers`} replace />;
  if (isLoading || !job) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b0c', color: '#8d8a82' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>;

  const title = jobTitle(job, isAr);
  const tasks = jobTasks(job, isAr);
  const about = ABOUT[isAr ? 'ar' : 'en'];
  const url = `${SITE}${prefix}/careers/${job.slug}`;
  const pageTitle = isAr ? `${title} — وظيفة في الرياض | إبرة وخيط الإسكافي` : `${title} — Job in Riyadh | Ebra & Khait Cobbler`;
  const metaDesc = (tasks.slice(0, 3).join(isAr ? '، ' : ', ') || title).slice(0, 155);
  const posted = job.created_at?.slice(0, 10);
  const until = new Date(Math.max(new Date(job.created_at).getTime() + 90 * 864e5, Date.now() + 30 * 864e5)).toISOString().slice(0, 10);
  const htmlDesc = `<p>${about.p}</p><ul>${tasks.map((t) => `<li>${t.replace(/</g, '&lt;')}</li>`).join('')}</ul>`;

  return (
    <div className="min-h-screen" style={{ background: '#0b0b0c', color: INK }} dir={isAr ? 'rtl' : 'ltr'}>
      <Helmet>
        <html lang={isAr ? 'ar' : 'en'} dir={isAr ? 'rtl' : 'ltr'} />
        <title>{pageTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={url} />
        <link rel="alternate" hrefLang="ar" href={`${SITE}/careers/${job.slug}`} />
        <link rel="alternate" hrefLang="en" href={`${SITE}/en/careers/${job.slug}`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE}/careers/${job.slug}`} />
        <meta name="robots" content="index, follow, max-snippet:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={url} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org/', '@type': 'JobPosting', title, description: htmlDesc,
          identifier: { '@type': 'PropertyValue', name: 'Ebra & Khait Cobbler', value: job.id },
          datePosted: posted, validThrough: until, employmentType: SCHEMA_EMP[job.employment_type] || 'FULL_TIME', directApply: true,
          industry: 'Leather goods repair and restoration', inLanguage: isAr ? 'ar' : 'en',
          hiringOrganization: { '@type': 'Organization', name: isAr ? 'إبرة وخيط الإسكافي' : 'Ebra & Khait Cobbler', alternateName: 'Ebra & Khait Cobbler', sameAs: SITE, logo: `${SITE}/images/cobblers-official-mark-white.png` },
          jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Riyadh', addressRegion: 'Riyadh Region', addressCountry: 'SA', ...(job.location ? { streetAddress: job.location } : {}) } },
          url,
        })}</script>
      </Helmet>

      <LogoBar isAr={isAr} prefix={prefix} />

      <main className="max-w-2xl mx-auto px-5 pb-20">
        <nav className="text-sm mt-4 mb-8" style={{ color: '#8d8a82' }}>
          <Link to={`${prefix}/careers`} className="underline">{isAr ? 'كل الوظائف' : 'All positions'}</Link>
        </nav>

        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#8d8a82' }}>{job.department || (isAr ? 'الفريق' : 'Team')}</p>
        <h1 className="text-3xl sm:text-4xl font-light leading-tight mb-5">{title}</h1>
        <div className="flex flex-wrap gap-5 text-sm mb-10" style={{ color: '#bdb8ad' }}>
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{EMP[isAr ? 'ar' : 'en'][job.employment_type]}</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{job.location || (isAr ? 'الرياض' : 'Riyadh')}</span>
        </div>

        <section className="mb-10">
          <h2 className="text-sm tracking-[0.2em] uppercase mb-3" style={{ color: '#8d8a82' }}>{about.h}</h2>
          <p className="font-light leading-loose" style={{ color: '#a8a398' }}>{about.p}</p>
        </section>

        {tasks.length > 0 && (
          <section className="mb-12">
            <h2 className="text-sm tracking-[0.2em] uppercase mb-4" style={{ color: '#8d8a82' }}>{isAr ? 'مهام الوظيفة' : 'Role responsibilities'}</h2>
            <ul className="space-y-3">
              {tasks.map((t, i) => (
                <li key={i} className="flex gap-3 leading-relaxed" style={{ borderBottom: `1px solid ${HAIR}`, paddingBottom: 12 }}>
                  <span className="mt-2 w-1.5 h-1.5 shrink-0" style={{ background: INK }} /><span style={{ color: '#d6d1c6' }}>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ApplyForm job={job} isAr={isAr} />
      </main>
    </div>
  );
}
