import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { Briefcase, MapPin, ArrowLeft, ArrowRight } from 'lucide-react';

const EMPLOYMENT_LABELS_AR = { full_time: 'دوام كامل', part_time: 'دوام جزئي', contract: 'عقد مؤقت' };
const EMPLOYMENT_LABELS_EN = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' };

export default function Careers() {
  useTrackVisit('/careers');
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-job-postings'],
    queryFn: () => db.JobPosting.filter({ is_active: true }, '-created_at', 100),
  });

  const title = isAr ? 'الوظائف الشاغرة | إبرة وخيط الإسكافي' : 'Careers | Ebra & Khait Cobbler';
  const desc = isAr
    ? 'انضم لفريق إبرة وخيط الإسكافي بالرياض — تصفّح الوظائف الشاغرة الحالية وقدّم الآن.'
    : 'Join the Ebra & Khait Cobbler team in Riyadh — browse current openings and apply now.';

  return (
    <div className="min-h-screen font-tajawal" style={{ background: 'var(--cream-bg, #F9F7F2)' }} dir={isAr ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href="https://needlecobbler.com/careers" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content="https://needlecobbler.com/careers" />
        {jobs.length > 0 && (
          <script type="application/ld+json">{JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": jobs.map((j, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "url": `https://needlecobbler.com/careers/${j.slug}`,
            })),
          })}</script>
        )}
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-14">
        <Link to="/" className="text-sm opacity-60 hover:opacity-100 transition-opacity">
          {isAr ? '← الرئيسية' : '← Home'}
        </Link>

        <div className="mt-6 mb-10 text-center">
          <Briefcase className="w-9 h-9 mx-auto mb-3 opacity-70" />
          <h1 className="text-3xl font-black mb-2">{isAr ? 'انضم لفريقنا' : 'Join Our Team'}</h1>
          <p className="opacity-70 max-w-xl mx-auto">
            {isAr
              ? 'نبحث عن حرفيين وموظفين شغوفين بالجودة والاحترافية للانضمام لإبرة وخيط الإسكافي.'
              : 'We are looking for skilled, passionate craftsmen and staff to join Ebra & Khait Cobbler.'}
          </p>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-black/5" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 opacity-60">
            {isAr ? 'ما فيه وظائف شاغرة حالياً — تابعنا لآخر التحديثات.' : 'No open positions right now — check back soon.'}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(j => (
              <Link
                key={j.id}
                to={`/careers/${j.slug}`}
                className="block bg-white rounded-xl border border-black/5 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-bold text-lg">{j.title}</h2>
                    <div className="flex items-center gap-3 text-sm opacity-60 mt-1 flex-wrap">
                      <span>{isAr ? EMPLOYMENT_LABELS_AR[j.employment_type] : EMPLOYMENT_LABELS_EN[j.employment_type]}</span>
                      {j.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{j.location}</span>}
                    </div>
                  </div>
                  <ArrowIcon className="w-5 h-5 opacity-40 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
