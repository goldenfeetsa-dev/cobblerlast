import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { Briefcase, MapPin, Wallet, MessageCircle, Mail, Phone, ExternalLink } from 'lucide-react';

const EMPLOYMENT_LABELS_AR = { full_time: 'دوام كامل', part_time: 'دوام جزئي', contract: 'عقد مؤقت' };
const EMPLOYMENT_LABELS_EN = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' };
// القيم اللي يتطلبها schema.org/JobPosting بالضبط لـ employmentType
const SCHEMA_EMPLOYMENT_TYPE = { full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR' };

function applyHref(job) {
  switch (job.apply_method) {
    case 'whatsapp': return `https://wa.me/${job.apply_value}?text=${encodeURIComponent('مرحباً، أبي أقدم على وظيفة "' + job.title + '"')}`;
    case 'email': return `mailto:${job.apply_value}?subject=${encodeURIComponent('التقديم على وظيفة: ' + job.title)}`;
    case 'phone': return `tel:${job.apply_value}`;
    default: return job.apply_value;
  }
}

export default function CareerDetail() {
  const { slug } = useParams();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  useTrackVisit(`/careers/${slug}`);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['public-job-postings'],
    queryFn: () => db.JobPosting.filter({ is_active: true }, '-created_at', 100),
  });

  const job = jobs?.find(j => j.slug === slug);

  if (!isLoading && jobs && !job) return <Navigate to="/careers" replace />;
  if (isLoading || !job) {
    return <div className="min-h-screen flex items-center justify-center opacity-50">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</div>;
  }

  const ApplyIcon = { whatsapp: MessageCircle, email: Mail, phone: Phone, link: ExternalLink }[job.apply_method];
  const pageUrl = `https://needlecobbler.com/careers/${job.slug}`;
  const metaDesc = (job.description || job.title).slice(0, 155);

  return (
    <div className="min-h-screen font-tajawal" style={{ background: 'var(--cream-bg, #F9F7F2)' }} dir={isAr ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>{job.title} | إبرة وخيط الإسكافي</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={job.title} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={pageUrl} />
        {/* JobPosting — لازم يظهر بنتائج بحث جوجل للوظائف (Google Jobs) */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org/",
          "@type": "JobPosting",
          "title": job.title,
          "description": job.description || job.requirements || job.title,
          "identifier": {
            "@type": "PropertyValue",
            "name": "Ebra & Khait Cobbler",
            "value": job.id,
          },
          "datePosted": job.created_at?.slice(0, 10),
          "validThrough": new Date(new Date(job.created_at).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          "employmentType": SCHEMA_EMPLOYMENT_TYPE[job.employment_type] || 'FULL_TIME',
          "hiringOrganization": {
            "@type": "Organization",
            "name": "إبرة وخيط الإسكافي",
            "sameAs": "https://needlecobbler.com",
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": job.location || "الرياض",
              "addressCountry": "SA",
            },
          },
        })}</script>
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 py-14">
        <Link to="/careers" className="text-sm opacity-60 hover:opacity-100 transition-opacity">
          {isAr ? '← كل الوظائف' : '← All jobs'}
        </Link>

        <div className="mt-6 bg-white rounded-2xl border border-black/5 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 opacity-60" />
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/5">
              {isAr ? EMPLOYMENT_LABELS_AR[job.employment_type] : EMPLOYMENT_LABELS_EN[job.employment_type]}
            </span>
          </div>
          <h1 className="text-2xl font-black mb-3">{job.title}</h1>
          <div className="flex items-center gap-4 flex-wrap text-sm opacity-70 mb-6">
            {job.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>}
            {job.salary_note && <span className="flex items-center gap-1"><Wallet className="w-4 h-4" />{job.salary_note}</span>}
          </div>

          {job.description && (
            <div className="mb-6">
              <h2 className="font-bold mb-2">{isAr ? 'عن الوظيفة' : 'About the role'}</h2>
              <p className="opacity-80 whitespace-pre-line leading-relaxed">{job.description}</p>
            </div>
          )}

          {job.requirements && (
            <div className="mb-8">
              <h2 className="font-bold mb-2">{isAr ? 'المتطلبات' : 'Requirements'}</h2>
              <p className="opacity-80 whitespace-pre-line leading-relaxed">{job.requirements}</p>
            </div>
          )}

          <a
            href={applyHref(job)}
            target={job.apply_method === 'link' ? '_blank' : undefined}
            rel={job.apply_method === 'link' ? 'noopener noreferrer' : undefined}
            className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-xl text-white transition-transform hover:scale-[1.02]"
            style={{ background: 'var(--accent-gold, #C5A059)', color: '#1A130B' }}
          >
            <ApplyIcon className="w-4.5 h-4.5" />
            {isAr ? 'قدّم الآن' : 'Apply Now'}
          </a>
        </div>
      </div>
    </div>
  );
}
