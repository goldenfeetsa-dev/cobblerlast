import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Award, Heart, Users, Shield } from 'lucide-react';
import { useTrackVisit } from '@/hooks/useTrackVisit';

const GOLD = '#C9A84C';
const DARK = '#1A0F00';
const TEXT = '#F5EDD8';

function FadeIn({ children, delay = 0, className = '' }) {
  return (
    <motion.div className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export default function AboutUs() {
  useTrackVisit('/about');

  const stats = [
    { number: '+10', label: 'سنوات خبرة' },
    { number: '+5000', label: 'عميل سعيد' },
    { number: '+20', label: 'علامة فاخرة' },
    { number: '100%', label: 'ضمان الجودة' },
  ];

  const values = [
    { icon: Award, title: 'الحرفية الأصيلة', desc: 'نؤمن أن كل قطعة تستحق عناية حقيقية بأيدٍ متمرسة، لا آلات باردة.' },
    { icon: Heart, title: 'شغف حقيقي', desc: 'نحن لا نصلح فقط — نُعيد الحياة لما تعلقت به قلوبكم من أحذية وحقائب.' },
    { icon: Shield, title: 'ضمان كامل', desc: 'كل خدمة نقدمها مضمونة. إذا لم تكن راضياً، نُكمل حتى تكون.' },
    { icon: Users, title: 'خبرة سعودية', desc: 'فريق من الحرفيين السعوديين المتخصصين الذين يفهمون ذوق وتوقعات العميل السعودي.' },
  ];

  const team = [
    { name: 'أبو خالد', role: 'المؤسس وكبير الحرفيين', exp: '+15 سنة', emoji: '👨‍🔧' },
    { name: 'أبو محمد', role: 'متخصص الحقائب الفاخرة', exp: '+10 سنوات', emoji: '🎒' },
    { name: 'أبو عبدالله', role: 'خبير الأحذية الجلدية', exp: '+8 سنوات', emoji: '👞' },
  ];

  return (
    <div className="min-h-screen font-tajawal" style={{ background: '#060300', color: TEXT }}>
      <Helmet>
        <title>من نحن | إبرة وخيط الإسكافي — حرفيون سعوديون في الرياض</title>
        <meta name="description" content="تعرف على قصة إبرة وخيط الإسكافي — حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة في الرياض منذ أكثر من 10 سنوات." />
        <meta name="keywords" content="من نحن, إبرة وخيط الإسكافي, حرفيون سعوديون, إصلاح أحذية الرياض, تاريخ الشركة" />
        <link rel="canonical" href="https://cobblerlast.com/about" />
        <meta property="og:title" content="من نحن | إبرة وخيط الإسكافي" />
        <meta property="og:description" content="حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة في الرياض." />
        <meta property="og:url" content="https://cobblerlast.com/about" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "name": "من نحن — إبرة وخيط الإسكافي",
          "url": "https://cobblerlast.com/about",
          "description": "قصة وتاريخ إبرة وخيط الإسكافي",
          "mainEntity": {
            "@type": "LocalBusiness",
            "name": "إبرة وخيط الإسكافي",
            "foundingDate": "2013",
            "address": { "@type": "PostalAddress", "addressLocality": "الرياض", "addressCountry": "SA" },
            "numberOfEmployees": { "@type": "QuantitativeValue", "value": "10" }
          }
        })}</script>
      </Helmet>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-6"
        style={{ background: 'rgba(6,3,0,0.95)', borderBottom: '1px solid rgba(201,168,76,0.1)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between" dir="rtl">
          <Link to="/" className="text-lg font-black" style={{ color: GOLD }}>إبرة وخيط الإسكافي</Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm hover:text-yellow-400 transition-colors" style={{ color: 'rgba(245,237,216,0.5)' }}>الرئيسية</Link>
            <Link to="/book" className="px-4 py-2 rounded-full text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>احجز الآن</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center" dir="rtl">
        <FadeIn>
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: GOLD }}>من نحن</p>
          <h1 className="text-4xl md:text-6xl font-black mb-6" style={{ color: TEXT }}>
            قصة الحرفة<br /><span style={{ color: GOLD }}>والشغف</span>
          </h1>
          <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(245,237,216,0.5)' }}>
            بدأت إبرة وخيط الإسكافي من ورشة صغيرة في قلب الرياض، بأيدٍ سعودية تؤمن بأن كل حذاء وكل حقيبة تستحق أن تعيش من جديد.
          </p>
        </FadeIn>
      </section>

      {/* Stats */}
      <section className="py-14 px-6" style={{ background: 'rgba(201,168,76,0.04)', borderTop: '1px solid rgba(201,168,76,0.08)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6" dir="rtl">
          {stats.map((s, i) => (
            <FadeIn key={i} delay={i * 0.1} className="text-center">
              <div className="text-4xl font-black mb-1" style={{ color: GOLD }}>{s.number}</div>
              <div className="text-sm" style={{ color: 'rgba(245,237,216,0.4)' }}>{s.label}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="py-20 px-6" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.12)' }}>
                <img src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80"
                  alt="ورشة إبرة وخيط الإسكافي" className="w-full h-72 object-cover" />
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: GOLD }}>قصتنا</p>
              <h2 className="text-3xl font-black mb-5" style={{ color: TEXT }}>من الورشة إلى الفخامة</h2>
              <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,0.55)' }}>
                <p>بدأنا عام 2013 بورشة صغيرة متواضعة في الرياض، كان هدفنا الوحيد: إعادة الحياة لما تركه الزمن أثراً على الأحذية والحقائب الفاخرة.</p>
                <p>مع مرور السنين، تطورت مهاراتنا وتوسع فريقنا، لكن بقي جوهرنا ثابتاً: الحرفة الأصيلة والمواد الفاخرة والخدمة التي تتجاوز التوقعات.</p>
                <p>اليوم نخدم أكثر من 5000 عميل، ونتعامل مع أرقى العلامات التجارية العالمية كـ Hermès وLouis Vuitton وChanel.</p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6" style={{ background: '#080400' }} dir="rtl">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: GOLD }}>مبادئنا</p>
            <h2 className="text-3xl font-black" style={{ color: TEXT }}>ما نؤمن به</h2>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {values.map((v, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
                  <v.icon className="w-8 h-8 mb-4" style={{ color: GOLD }} />
                  <h3 className="font-black text-lg mb-2" style={{ color: TEXT }}>{v.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,0.45)' }}>{v.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 px-6" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: GOLD }}>الفريق</p>
            <h2 className="text-3xl font-black" style={{ color: TEXT }}>أيدٍ تصنع الفرق</h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {team.map((m, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="p-6 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
                  <div className="text-5xl mb-4">{m.emoji}</div>
                  <h3 className="font-black text-lg" style={{ color: TEXT }}>{m.name}</h3>
                  <p className="text-sm mt-1" style={{ color: GOLD }}>{m.role}</p>
                  <p className="text-xs mt-2" style={{ color: 'rgba(245,237,216,0.3)' }}>{m.exp}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center" style={{ background: '#080400' }} dir="rtl">
        <FadeIn>
          <h2 className="text-3xl font-black mb-4" style={{ color: TEXT }}>جاهز تبدأ معنا؟</h2>
          <p className="text-sm mb-8" style={{ color: 'rgba(245,237,216,0.4)' }}>احجز موعدك الآن وسنتولى الباقي</p>
          <Link to="/book">
            <button className="px-10 py-4 rounded-full font-black text-base text-black hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)', boxShadow: '0 8px 30px rgba(201,168,76,0.3)' }}>
              احجز الآن
            </button>
          </Link>
        </FadeIn>
      </section>

      {/* Footer mini */}
      <footer className="py-8 px-6 border-t text-center text-sm" dir="rtl"
        style={{ borderColor: 'rgba(201,168,76,0.08)', color: 'rgba(245,237,216,0.2)', background: '#060300' }}>
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <Link to="/" className="hover:text-yellow-400 transition-colors">الرئيسية</Link>
          <Link to="/about" className="hover:text-yellow-400 transition-colors" style={{ color: GOLD }}>من نحن</Link>
          <Link to="/privacy" className="hover:text-yellow-400 transition-colors">سياسة الخصوصية</Link>
          <Link to="/shipping-policy" className="hover:text-yellow-400 transition-colors">سياسة التوصيل</Link>
          <Link to="/repair-policy" className="hover:text-yellow-400 transition-colors">سياسة الإصلاح</Link>
        </div>
        <p>© {new Date().getFullYear()} إبرة وخيط الإسكافي. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  );
}
