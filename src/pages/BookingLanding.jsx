import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { FAQ, PAGES } from '@/lib/seo/siteData';
import { SERVICE_PAGES } from '@/lib/seo/services';
import { SECTORS, DISTRICTS } from '@/lib/seo/areas';
const HOME_SEO = PAGES.find((p) => p.path === '/');
import LanguageSwitcher from '@/components/LanguageSwitcher';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import LogoMarquee from '@/components/LogoMarquee';
import CleanLogo from '@/components/CleanLogo';

// بيانات عامة مخزّنة بالـ CDN (علامات/فروع/تواصل/سجل تجاري) — طلب واحد
// مشترك بين كل الأقسام بدل ما كل قسم يسوي استعلامه المنفصل لـ Supabase.
// راجع api/public/site-data.js لتفاصيل التخزين المؤقت على مستوى Vercel.
function useSiteData() {
  return useQuery({
    queryKey: ['site-data-public'],
    queryFn: async () => {
      const res = await fetch('/api/public/site-data');
      if (!res.ok) throw new Error('site_data_failed');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
import {
  MapPin, Phone, Clock, Instagram, MessageCircle, Star, Award, Shield,
  Scissors, Sparkles, Package, ExternalLink, ChevronDown, Gem, ShoppingBag, Twitter, ArrowLeft, ArrowRight, Heart, CheckCircle, Menu, X, CalendarCheck, Smartphone
} from 'lucide-react';

// أيقونة تيك توك — lucide-react ما فيها شعار تيك توك رسمي، فسويناها
// كـ SVG مخصص بنفس واجهة أيقونات lucide (className + style.color) عشان
// تتصرف بنفس طريقة باقي أيقونات السوشيال ميديا بالضبط.
function TiktokIcon({ className, style }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M16.6 5.82c-.78-.85-1.24-1.95-1.29-3.14h-3.02v13.9c0 1.5-1.22 2.72-2.72 2.72a2.72 2.72 0 0 1 0-5.44c.26 0 .51.04.75.1v-3.06a5.78 5.78 0 0 0-.75-.05 5.78 5.78 0 1 0 5.78 5.78V9.4a8.7 8.7 0 0 0 5.08 1.63V8.01a5.35 5.35 0 0 1-3.83-2.19Z" />
    </svg>
  );
}

// ── Palette v2 — مبنية على الشعار الرسمي (نفس design-system.json) ──
// كل قيمة هنا مطابقة حرفياً لـ tokens.json حتى تكون هذه الصفحة (أهم
// صفحة بالموقع) متطابقة مع باقي التطبيق بدل أن تكون بمعزل عنه بألوان
// قديمة سابقة على اعتماد الشعار الرسمي.
const G   = '#ece8df';   // brand-brass — للخلفيات والحدود والتدرّجات الكبيرة فقط (وليس النص)
const GT  = '#ece8df';   // primary — حبر الشعار الرسمي بالضبط (تم أخذ عيّنة منه برمجياً)،
                          // يُستخدم للنص والأيقونات حصراً (brass لا يكفي تباينه للنص الصغير)
const D   = '#131315';   // secondary — كريمي أغمق شوي، لتدرّجات بسيطة
const T   = '#ece8df';   // foreground — النص الأساسي الداكن في كل الموقع
const GB  = 'rgba(236,232,223,'; // نفس G (brand-brass) بصيغة rgba قابلة لإضافة شفافية
const GL  = '#cfc9bb';   // تدرّج ذهبي/برونزي أفتح (brand-brass في الوضع الداكن)
const BG1 = '#0b0b0c';   // background — بيج واضح (كان قريب جداً من الأبيض)
const BG2 = '#131315';   // قسم متبادل أغمق شوي، لإحساس بصري بالفصل بين الأقسام

// ── FadeIn ────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '', x = 0, y = 32 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y, x }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// ── Magnetic Button ───────────────────────────────────────────────
function MagneticBtn({ children, className = '', style = {}, onClick }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const handleMove = useCallback((e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setPos({ x: (e.clientX - cx) * 0.25, y: (e.clientY - cy) * 0.25 });
  }, []);
  return (
    <motion.button ref={ref} onMouseMove={handleMove} onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      whileTap={{ scale: 0.95 }} className={className} style={style} onClick={onClick}>
      {children}
    </motion.button>
  );
}

// ── Glowing Orb ───────────────────────────────────────────────────
function GlowOrb({ x, y, size, color, blur = 120 }) {
  return (
    <motion.div className="absolute pointer-events-none rounded-full"
      style={{ left: x, top: y, width: size, height: size, background: color, filter: `blur(${blur}px)`, transform: 'translate(-50%,-50%)' }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.65, 0.4] }}
      transition={{ duration: 6 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut' }} />
  );
}

// ── Counter Anim ──────────────────────────────────────────────────
function AnimCounter({ target, duration = 2 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const num = parseInt(target.replace(/\D/g, ''));
    let start = 0;
    const step = num / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= num) { setCount(num); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, target, duration]);
  const prefix = target.startsWith('+') ? '+' : '';
  const suffix = target.endsWith('%') ? '%' : '';
  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

// ── Navbar ────────────────────────────────────────────────────────
function Navbar() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  // القائمة تُغلق تلقائياً لو المستخدم كبّر الشاشة (نفس الأخطاء
  // الشائعة بقوائم الجوال اللي تفضل مفتوحة على شاشات ديسكتوب)
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const links = [
    { label: t('common.nav.services'), href: '#services' },
    { label: isAr ? 'دكّة الإسكافي' : "Cobbler's Bench", href: '/shop', to: true },
    { label: isAr ? 'سوق المزاد' : 'Auction', href: '/auction', to: true },
    { label: t('common.nav.story'), href: '#about' },
    { label: t('common.nav.customers'), href: '#reviews' },
    { label: isAr ? 'تتبّع طلبك' : 'Track order', href: '#track', anchorOnHome: true },
  ];

  return (
    <motion.nav className="fixed top-0 inset-x-0 z-50 px-6"
      initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      <div className={`max-w-7xl mx-auto mt-3 rounded-2xl px-5 h-14 flex items-center justify-between transition-all duration-500 ${scrolled ? 'shadow-2xl' : ''}`}
        style={{ background: scrolled ? 'rgba(11,11,12,0.78)' : 'rgba(11,11,12,0.45)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)', border: `1px solid ${scrolled ? GB + '0.25)' : GB + '0.1)'}`, boxShadow: scrolled ? `0 8px 32px rgba(62,39,35,0.08), inset 0 1px 0 rgba(255,255,255,0.5)` : 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
        <Link to="/" dir={dir}>
          <motion.div whileHover={{ scale: 1.03 }} className="flex items-center gap-2">
            <img
              src="/images/cobblers-official-mark-white.png"
              alt={t('common.brandShort')}
              className="w-8 h-8 rounded-lg object-contain"
            />
            <span className="font-black text-sm" style={{ color: T }}>{t('common.brandShort')}</span>
          </motion.div>
        </Link>

        <div className="hidden md:flex items-center gap-6" dir={dir}>
          {links.map(l => l.to
            ? <Link key={l.label} to={l.href} className="text-sm font-medium transition-colors hover:opacity-70" style={{ color: '#bdb8ad' }}>{l.label}</Link>
            : <a key={l.label} href={l.href} className="text-sm font-medium transition-colors hover:opacity-70" style={{ color: '#bdb8ad' }}>{l.label}</a>
          )}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link to="/my-bookings" className="hidden md:block text-xs font-bold px-4 py-2 rounded-full transition-all"
            style={{ color: GT, border: `1px solid ${GB}0.3)`, background: GB + '0.05)' }}>
            {t('common.nav.trackBooking')}
          </Link>
          <Link to="/book" className="hidden sm:block">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="text-xs font-black px-5 py-2 rounded-full text-black"
              style={{ background: `linear-gradient(135deg, ${G}, ${GL})`, boxShadow: `0 4px 20px ${GB}0.4)` }}>
              {t('common.nav.bookNow')}
            </motion.div>
          </Link>
          {/* زر قائمة الجوال — كانت روابط الموقع (الخدمات/قصتنا/آراء العملاء/
              المتجر/تتبع الحجز) تختفي بالكامل على الجوال بدون أي بديل إطلاقاً،
              فالزائر من الجوال ما يقدر يوصلها أبداً */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: GB + '0.08)', border: `1px solid ${GB}0.2)`, color: T }}
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden max-w-7xl mx-auto mt-2 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(11,11,12,0.96)', backdropFilter: 'blur(20px)', border: `1px solid ${GB}0.15)` }}
          >
            <div className="p-4 flex flex-col gap-1" dir={dir}>
              {links.map(l => l.to
                ? <Link key={l.label} to={l.href} onClick={() => setMobileOpen(false)}
                    className="text-sm font-medium py-3 px-3 rounded-xl transition-colors hover:bg-[rgba(236,232,223,0.06)]" style={{ color: T }}>{l.label}</Link>
                : <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
                    className="text-sm font-medium py-3 px-3 rounded-xl transition-colors hover:bg-[rgba(236,232,223,0.06)]" style={{ color: T }}>{l.label}</a>
              )}
              <Link to="/my-bookings" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 text-sm font-bold py-3 px-3 rounded-xl mt-1"
                style={{ color: GT, border: `1px solid ${GB}0.25)` }}>
                <CalendarCheck className="w-4 h-4" />
                {t('common.nav.trackBooking')}
              </Link>
              <Link to="/book" onClick={() => setMobileOpen(false)}
                className="text-center text-sm font-black py-3 rounded-xl text-black mt-1"
                style={{ background: `linear-gradient(135deg, ${G}, ${GL})` }}>
                {t('common.nav.bookNow')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function HeroSection() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  return (
    <section className="relative overflow-hidden" style={{ background: '#0b0b0c', minHeight: '100svh' }}>
      <img src="/images/gallery/bag-after.png" alt={isAr ? 'حقيبة جلدية بعد الترميم في ورشة إبرة وخيط الإسكافي' : 'Leather handbag after restoration at Ebra & Khait Cobbler'}
        className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'grayscale(.25) contrast(1.08)' }} fetchpriority="high" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,5,6,.55) 0%, rgba(5,5,6,.45) 40%, rgba(5,5,6,.82) 100%)' }} />
      <div className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col justify-end" dir={dir} style={{ minHeight: '100svh', paddingTop: 120, paddingBottom: 72 }}>
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div className="max-w-sm space-y-6">
            <p className="text-base md:text-lg leading-loose font-light" style={{ color: '#cfcac0' }}>{t('home.hero.desc')}</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/book" className="inline-flex items-center gap-2 px-8 h-13 py-3.5 font-bold text-sm md:text-base transition-colors"
                style={{ background: '#ece8df', color: '#0b0b0c', border: '1px solid #ece8df' }}>
                {t('home.hero.ctaPrimary')}<ArrowIcon className="w-4 h-4" />
              </Link>
              <Link to="/shop" className="inline-flex items-center gap-2 px-8 py-3.5 font-bold text-sm md:text-base transition-colors hover:bg-[#ece8df] hover:text-[#0b0b0c]"
                style={{ border: '1px solid #ece8df', color: '#ece8df' }}>
                {t('home.hero.ctaSecondary')}
              </Link>
            </div>
          </div>
          <div>
            <h1 className="font-display font-black leading-[1.08] text-white" style={{ fontSize: 'clamp(2.6rem, 8.5vw, 8rem)', letterSpacing: '-.02em' }}>
              {t('home.hero.titleStart')}{' '}<span style={{ color: '#ece8df' }}>{t('home.hero.titleEnd')}</span>
            </h1>
            <h2 className="mt-4 text-sm md:text-base font-light tracking-wide" style={{ color: '#bdb8ad' }}>{t('home.hero.seoSubtitle')}</h2>
          </div>
        </div>
        <div className="mt-14 pt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm" style={{ borderTop: '1px solid rgba(236,232,223,.18)', color: '#bdb8ad' }}>
          {(t('home.hero.stats') || []).map((s, i) => (
            <div key={i} className="flex items-baseline gap-2"><span className="text-2xl font-black" style={{ color: '#ece8df' }}><AnimCounter target={s.num} /></span><span>{s.label}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TickerStrip() {
  const { t } = useLanguage();
  const items = t('home.ticker');
  return (
    <div className="py-4 overflow-hidden relative" style={{ background: `linear-gradient(90deg, ${D}, #1a1a1c, ${D})`, borderTop: `1px solid ${GB}0.15)`, borderBottom: `1px solid ${GB}0.15)` }}>
      <div className="flex gap-0">
        {[0, 1].map(k => (
          <motion.div key={k} className="flex gap-10 shrink-0 pe-10"
            animate={{ x: ['0%', '-100%'] }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
            {items.map((item, i) => (
              <span key={i} className="whitespace-nowrap text-sm font-bold" style={{ color: GT }}>{item}</span>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Services ─────────────────────────────────────────────────────
const SERVICE_META = [
  { icon: Scissors, img: '/images/gallery/sneaker-after.png' },
  { icon: Package, img: '/images/gallery/bag-before.png' },
  { icon: Sparkles, img: '/images/gallery/bag-after.png' },
];
const STEP_ICONS = [MessageCircle, Package, Scissors, CheckCircle];

function ServicesSection() {
  const { t, dir } = useLanguage();
  const services = t('home.services.items');
  const steps = t('home.services.steps');
  return (
    <section id="services" className="py-32 px-6" style={{ background: '#0b0b0c' }}>
      <div className="max-w-6xl mx-auto" dir={dir}>
        <FadeIn className="text-center mb-16">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>{t('home.services.eyebrow')}</p>
          <h2 className="font-display text-4xl md:text-5xl font-black mb-4" style={{ color: T }}>{t('home.services.title')}</h2>
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: '#a8a398' }}>
            {t('home.services.desc')}
          </p>
          <div className="mt-6 w-24 h-0.5 mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <motion.div className="group rounded-3xl overflow-hidden h-full flex flex-col cursor-pointer"
                style={{ background: `rgba(236,232,223,0.035)`, border: `1px solid ${GB}0.08)` }}
                whileHover={{ y: -8, borderColor: `${GB}0.25)`, boxShadow: `0 30px 60px ${GB}0.15)` }}
                transition={{ duration: 0.35 }}>

                {/* Image */}
                <div className="relative overflow-hidden" style={{ height: 220 }}>
                  <motion.img src={SERVICE_META[i].img} alt={s.title + ' — إبرة وخيط الإسكافي'}
                    className="w-full h-full object-cover" loading="lazy"
                    whileHover={{ scale: 1.08 }} transition={{ duration: 0.6 }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #0A0500 100%)' }} />
                  {/* Price tag */}
                  <div className="absolute top-4 start-4 px-3 py-1.5 rounded-xl text-xs font-black text-black"
                    style={{ background: `linear-gradient(135deg, ${G}, ${GL})` }}>{s.price}</div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <span className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full text-xs font-bold w-fit"
                    style={{ background: GB + '0.1)', color: GT, border: `1px solid ${GB}0.2)` }}>
                    {React.createElement(SERVICE_META[i].icon, { className: 'w-3 h-3' })}{s.tag}
                  </span>
                  <h3 className="text-xl font-black mb-2" style={{ color: T }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: '#a8a398' }}>{s.desc}</p>
                  <Link to="/book">
                    <motion.div whileHover={{ gap: '16px' }} className="flex items-center gap-2 font-bold text-sm"
                      style={{ color: GT }}>
                      <span>{t('home.services.bookThis')}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </motion.div>
                  </Link>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>

        {/* How it works */}
        <FadeIn delay={0.2} className="mt-24">
          <div className="rounded-3xl p-8 md:p-12" style={{ background: 'rgba(236,232,223,0.04)', border: `1px solid ${GB}0.1)` }}>
            <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase text-center" style={{ color: GT }}>{t('home.services.howItWorks')}</p>
            <h3 className="text-3xl font-black text-center mb-10" style={{ color: T }}>{t('home.services.howItWorksTitle')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {steps.map((step, i) => (
                <FadeIn key={i} delay={i * 0.1} className="text-center">
                  <div className="relative inline-flex mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                      style={{ background: `linear-gradient(135deg, ${GB}0.12), ${GB}0.04))`, border: `1px solid ${GB}0.2)` }}>
                      {React.createElement(STEP_ICONS[i], { className: 'w-6 h-6', style: { color: GT } })}
                    </div>
                    <span className="absolute -top-2 -end-2 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center text-black"
                      style={{ background: `linear-gradient(135deg, ${G}, ${GL})` }}>{i + 1}</span>
                  </div>
                  <h4 className="font-black mb-1.5" style={{ color: T }}>{step.t}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: '#a8a398' }}>{step.d}</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Before / After Gallery ──────────────────────────────────────────
function BeforeAfterSection() {
  const { t, dir } = useLanguage();
  const items = t('home.beforeAfter.items');
  return (
    <section id="before-after" className="py-32 px-6" style={{ background: '#26262a' }}>
      <div className="max-w-6xl mx-auto" dir={dir}>
        <FadeIn className="text-center mb-16">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>{t('home.beforeAfter.eyebrow')}</p>
          <h2 className="font-display text-4xl md:text-5xl font-black mb-4" style={{ color: T }}>{t('home.beforeAfter.title')}</h2>
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: '#a8a398' }}>
            {t('home.beforeAfter.desc')}
          </p>
          <div className="mt-6 w-24 h-0.5 mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {items.map((item, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${GB}0.12)`, background: 'rgba(236,232,223,0.035)' }}>
                <BeforeAfterSlider
                  beforeImage={item.before}
                  afterImage={item.after}
                  beforeLabel={dir === 'rtl' ? 'قبل' : 'Before'}
                  afterLabel={dir === 'rtl' ? 'بعد' : 'After'}
                />
                <div className="px-5 py-4 text-center">
                  <p className="font-black text-sm" style={{ color: T }}>{item.label}</p>
                  <p className="text-[11px] mt-1" style={{ color: '#a8a398' }}>{t('home.beforeAfter.hint')}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Request Service ───────────────────────────────────────────────
function RequestServiceSection() {
  const { t, dir } = useLanguage();
  const [form, setForm] = useState({ name: '', phone: '', service: '', notes: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.phone) return;
    setLoading(true);
    setError('');
    try {
      const { error: dbError } = await supabase.from('bookings').insert({
        customer_name: form.name, customer_phone: form.phone,
        notes: `${t('home.request.serviceLabel')}: ${form.service}\n${form.notes}`, status: 'pending',
      });
      if (dbError) throw dbError;
      setSent(true);
    } catch (err) {
      setError(err?.message || t('home.request.error') || 'حدث خطأ أثناء الإرسال، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="request" className="py-32 px-6" style={{ background: '#26262a' }}>
      <div className="max-w-5xl mx-auto" dir={dir}>
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>{t('home.request.eyebrow')}</p>
          <h2 className="font-display text-4xl md:text-5xl font-black mb-4" style={{ color: T }}>{t('home.request.title')}</h2>
          <p className="text-sm" style={{ color: '#a8a398' }}>{t('home.request.desc')}</p>
        </FadeIn>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 rounded-3xl" style={{ background: GB + '0.05)', border: `1px solid ${GB}0.15)` }}>
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6 }}>
                <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: GT }} />
              </motion.div>
              <h3 className="text-2xl font-black mb-2" style={{ color: T }}>{t('home.request.doneTitle')}</h3>
              <p style={{ color: '#bdb8ad' }}>{t('home.request.doneDesc')}</p>
              <button onClick={() => setSent(false)} className="mt-6 text-sm underline" style={{ color: GT }}>{t('home.request.sendAnother')}</button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-3xl p-8 md:p-12" style={{ background: 'rgba(236,232,223,0.035)', border: `1px solid ${GB}0.1)` }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {[['name', t('home.request.nameLabel'), t('home.request.namePh')], ['phone', t('home.request.phoneLabel'), '05XXXXXXXX']].map(([k, label, ph]) => (
                  <div key={k} className="space-y-2">
                    <label className="text-xs font-bold" style={{ color: '#bdb8ad' }}>{label}</label>
                    <input value={form[k]} onChange={e => upd(k, e.target.value)}
                      placeholder={ph} dir={k === 'phone' ? 'ltr' : dir}
                      className="w-full px-4 py-3.5 rounded-xl outline-none text-sm transition-all"
                      style={{ background: GB + '0.04)', border: `1px solid ${GB}0.12)`, color: T }}
                      onFocus={e => e.target.style.borderColor = GB + '0.4)'}
                      onBlur={e => e.target.style.borderColor = GB + '0.12)'} />
                  </div>
                ))}
              </div>
              <div className="mb-5 space-y-2">
                <label className="text-xs font-bold" style={{ color: '#bdb8ad' }}>{t('home.request.serviceLabel')}</label>
                <select value={form.service} onChange={e => upd('service', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl outline-none text-sm"
                  style={{ background: GB + '0.04)', border: `1px solid ${GB}0.12)`, color: form.service ? T : `${GB}0.3)` }}>
                  <option value="">{t('home.request.chooseService')}</option>
                  {t('home.request.serviceOptions').map(s => (
                    <option key={s} value={s} style={{ background: '#0b0b0c' }}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="mb-8 space-y-2">
                <label className="text-xs font-bold" style={{ color: '#bdb8ad' }}>{t('home.request.notesLabel')}</label>
                <textarea value={form.notes} onChange={e => upd('notes', e.target.value)}
                  placeholder={t('home.request.notesPh')} rows={3}
                  className="w-full px-4 py-3.5 rounded-xl outline-none text-sm resize-none"
                  style={{ background: GB + '0.04)', border: `1px solid ${GB}0.12)`, color: T }} />
              </div>
              {error && (
                <p className="mb-4 text-sm text-center rounded-xl py-3 px-4" style={{ color: '#ff6b6b', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.25)' }}>
                  {error}
                </p>
              )}
              <MagneticBtn onClick={submit}
                className="w-full py-4 rounded-2xl font-black text-base text-black transition-all"
                style={{ background: `linear-gradient(135deg, ${G}, ${GL})`, boxShadow: `0 12px 40px ${GB}0.4)`, opacity: loading ? 0.7 : 1 }}>
                {loading ? t('home.request.sending') : t('home.request.send')}
              </MagneticBtn>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ── About ─────────────────────────────────────────────────────────
const ABOUT_STAT_ICONS = [Award, Star, Shield, Gem];
function AboutSection() {
  const { t, dir } = useLanguage();
  const stats = t('home.about.stats');
  return (
    <section id="about" className="py-32 px-6" style={{ background: '#0b0b0c' }} dir={dir}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeIn className="grid grid-cols-2 gap-3">
            {[
              { src: '/images/gallery/bag-after.png', alt: 'حرفي متخصص يصلح حقيبة جلدية فاخرة' },
              { src: '/images/gallery/bag-before.png', alt: 'أدوات وخيوط ورشة إصلاح الأحذية' },
              { src: '/images/gallery/sneaker-before.png', alt: 'ورشة إبرة وخيط الإسكافي في الرياض' },
              { src: '/images/gallery/sneaker-after.png', alt: 'تبديل نعل حذاء جلدي فاخر' },
            ].map((img, i) => (
                <motion.div key={i} className={`rounded-2xl overflow-hidden ${i % 2 === 1 ? 'mt-6' : ''}`}
                  style={{ border: `1px solid ${GB}0.1)` }}
                  whileHover={{ scale: 1.03, borderColor: GB + '0.3)' }} transition={{ duration: 0.3 }}>
                  <img src={img.src} alt={img.alt} className="w-full h-44 object-cover" loading="lazy" />
                </motion.div>
              ))}
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-xs tracking-[0.5em] font-bold mb-4 uppercase" style={{ color: GT }}>{t('home.about.eyebrow')}</p>
            <h2 className="font-display text-4xl md:text-5xl font-black mb-6 leading-tight" style={{ color: T }}>
              {t('home.about.titleLine1')}<br /><span style={{ color: GT }}>{t('home.about.titleLine2')}</span>
            </h2>
            <p className="leading-relaxed text-base mb-8" style={{ color: '#a8a398' }}>
              {t('home.about.desc')}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {stats.map((s, i) => (
                <motion.div key={i} className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: GB + '0.05)', border: `1px solid ${GB}0.12)` }}
                  whileHover={{ borderColor: GB + '0.3)', scale: 1.02 }}>
                  {React.createElement(ABOUT_STAT_ICONS[i], { className: 'w-5 h-5 shrink-0', style: { color: GT } })}
                  <div>
                    <div className="text-xl font-black" style={{ color: GT }}><AnimCounter target={s.num} /></div>
                    <div className="text-xs" style={{ color: '#a8a398' }}>{s.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <Link to="/about">
              <MagneticBtn className="px-8 py-3.5 rounded-2xl font-bold text-base text-black"
                style={{ background: `linear-gradient(135deg, ${G}, ${GL})`, boxShadow: `0 8px 30px ${GB}0.3)` }}>
                {t('home.about.cta')}
              </MagneticBtn>
            </Link>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ── Reviews ───────────────────────────────────────────────────────
function ReviewsSection() {
  const { t, dir } = useLanguage();
  const reviews = t('home.reviews.items');
  const [active, setActive] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setActive(p => (p + 1) % reviews.length), 4500);
    return () => clearInterval(iv);
  }, [reviews.length]);
  return (
    <section className="py-32 px-6" style={{ background: '#26262a' }} dir={dir}>
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>{t('home.reviews.eyebrow')}</p>
          <h2 className="font-display text-4xl md:text-5xl font-black" style={{ color: T }}>{t('home.reviews.title')}</h2>
          <div className="mt-4 w-24 h-0.5 mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r, i) => (
            <FadeIn key={i} delay={i * 0.07}>
              <motion.div className="rounded-2xl p-6 flex flex-col gap-4 h-full cursor-pointer"
                animate={{ background: active === i ? GB + '0.07)' : 'rgba(236,232,223,0.035)', borderColor: active === i ? GB + '0.3)' : 'rgba(236,232,223,0.06)' }}
                style={{ border: '1px solid' }} whileHover={{ y: -4 }} onClick={() => setActive(i)}>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color: GT }} />)}
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: '#bdb8ad' }}>"{r.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-black shrink-0"
                    style={{ background: `linear-gradient(135deg, ${G}, ${GL})` }}>{r.name[0]}</div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: T }}>{r.name}</p>
                    <p className="text-xs" style={{ color: '#8d8a82' }}>{r.service}</p>
                  </div>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
        <div className="flex justify-center gap-2 mt-8">
          {reviews.map((_, i) => (
            <motion.button key={i} onClick={() => setActive(i)} className="rounded-full"
              animate={{ width: active === i ? 22 : 8, background: active === i ? G : GB + '0.2)' }}
              style={{ height: 8 }} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Brands ────────────────────────────────────────────────────────
function BrandsSection() {
  const { t, dir } = useLanguage();
  const { data: siteData } = useSiteData();
  const brands = siteData?.brands || [];
  const list = brands.length ? brands : [
    { name_ar: 'Hermès' }, { name_ar: 'Louis Vuitton' }, { name_ar: 'Chanel' }, { name_ar: 'Gucci' },
    { name_ar: 'Prada' }, { name_ar: 'Dior' }, { name_ar: 'Bottega' }, { name_ar: 'Ferragamo' },
    { name_ar: "Tod's" }, { name_ar: 'Louboutin' },
  ];
  // إعادة تصميم كاملة بناءً على الطلب: الشعار فقط، كبير وواضح
  // (بدل شريط متحرك بشعارات صغيرة جداً وأسماء نصية)، تحت عنوان
  // صريح "نتعامل مع" / "أرقى العلامات العالمية" يوضح للزائر إنه
  // مكان عرض العلامات التي تُعمل معها الورشة
  return (
    <section className="py-20 px-6" style={{ background: '#0b0b0c', borderTop: `1px solid ${GB}0.08)`, borderBottom: `1px solid ${GB}0.08)` }}>
      <div className="max-w-5xl mx-auto" dir={dir}>
        <FadeIn className="text-center mb-12">
          <p className="text-xs tracking-[0.5em] font-bold mb-2 uppercase" style={{ color: GT }}>{t('home.brands.eyebrow')}</p>
          <h3 className="text-2xl md:text-3xl font-black" style={{ color: T }}>{t('home.brands.title')}</h3>
        </FadeIn>
        <LogoMarquee items={list} />
      </div>
    </section>
  );
}

// ── Track Order ───────────────────────────────────────────────────
function TrackOrderSection() {
  const { t, dir } = useLanguage();
  const [code, setCode] = useState('');
  const [results, setResults] = useState(null); // null = لم يُبحث بعد، [] = بحث بدون نتائج
  const [loading, setLoading] = useState(false);
  const STATUS = t('home.track.status');

  const search = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      // كان الاستعلام يروح مباشرة لـ Supabase من المتصفح (anon key)،
      // وكان ممكن بس لأن RLS على orders كانت مفتوحة USING (true).
      // بعد إغلاق RLS (ميغريشن 026) صار لازم يمر عبر مسار عام من
      // السيرفر يستخدم صلاحية admin — نفس النتيجة والحقول بالضبط،
      // بس بدون الاعتماد على anon key للوصول المباشر لجدول محمي.
      const res = await fetch(`/api/public/site-data?code=${encodeURIComponent(code)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'server_error');
      setResults(json.results || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  return (
    <section id="track" className="py-28 px-6" style={{ background: '#26262a' }} dir={dir}>
      <div className="max-w-2xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>{t('home.track.eyebrow')}</p>
          <h2 className="font-display text-4xl font-black mb-3" style={{ color: T }}>{t('home.track.title')}</h2>
          <p className="text-sm mb-8" style={{ color: '#a8a398' }}>{t('home.track.desc')}</p>
          <div className="flex gap-3 max-w-md mx-auto mb-6">
            <input value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder={t('home.track.placeholder')} dir="ltr"
              className="flex-1 px-4 py-3.5 rounded-2xl outline-none text-sm"
              style={{ background: GB + '0.04)', border: `1px solid ${GB}0.15)`, color: T }} />
            <MagneticBtn onClick={search}
              className="px-6 py-3.5 rounded-2xl font-black text-sm text-black"
              style={{ background: `linear-gradient(135deg, ${G}, ${GL})` }}>
              {loading ? t('home.track.loading') : t('home.track.search')}
            </MagneticBtn>
          </div>
          <AnimatePresence>
            {results !== null && (
              results.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-2xl p-5 text-sm"
                  style={{ background: 'rgba(255,50,50,0.06)', border: '1px solid rgba(255,50,50,0.2)' }}>
                  <p style={{ color: 'rgba(255,100,100,0.8)' }}>{t('home.track.notFound')}</p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {results.length > 1 && (
                    <p className="text-xs text-start" style={{ color: '#bdb8ad' }}>
                      {t('home.track.multipleFound') || `عدد الطلبات الموجودة: ${results.length}`}
                    </p>
                  )}
                  {results.map((r, i) => (
                    <motion.div key={r.order_number || i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl p-5 text-sm"
                      style={{ background: GB + '0.06)', border: `1px solid ${GB}0.2)` }}>
                      <div className="text-start space-y-2">
                        <div className="font-black text-base" style={{ color: GT }}>{r.order_number}</div>
                        <div style={{ color: T }}>{t('home.track.customer')}: {r.customer_name}</div>
                        <div className="text-xl font-black" style={{ color: GT }}>{STATUS[r.status] || r.status}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )
            )}
          </AnimatePresence>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Branches ──────────────────────────────────────────────────────
// ── روابط الخدمات التفصيلية — تربط الرئيسية بصفحات الهبوط (روابط داخلية
// حقيقية تساعد جوجل والزواحف تكتشف كل خدمة وتفهم تخصصك).
function ServiceLinksSection() {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';
  const pre = isAr ? '' : '/en';
  return (
    <section id="service-pages" className="py-24 px-6" style={{ background: BG1 }} dir={dir}>
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-10">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>
            {isAr ? 'تخصصاتنا' : 'Specialties'}
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-black" style={{ color: T }}>
            {isAr ? 'تصليح أحذية وشنط في الرياض — اختر خدمتك' : 'Shoe & bag repair in Riyadh — choose your service'}
          </h2>
        </FadeIn>
        <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {SERVICE_PAGES.map((s) => (
            <li key={s.slug}>
              <Link to={`${pre}/services/${s.slug}`} className="block rounded-2xl px-5 py-4 font-bold text-sm h-full transition-shadow hover:shadow-md"
                style={{ background: '#131315', border: `1px solid ${GB}0.25)`, color: T }}>
                {s[isAr ? 'ar' : 'en'].name}
                <span className="block text-xs font-normal mt-1" style={{ color: '#a8a398' }}>{s[isAr ? 'ar' : 'en'].h1}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── مناطق الخدمة — روابط داخلية لصفحات الرياض والأحياء والسعودية
function AreasSection() {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';
  const pre = isAr ? '' : '/en';
  const top = ['hittin', 'malqa', 'olaya', 'yasmin', 'naseem', 'aziziyah', 'shifa', 'rawdah'].map((s) => DISTRICTS.find((d) => d.slug === s));
  const chip = { background: '#131315', border: `1px solid ${GB}0.3)`, color: T };
  return (
    <section id="areas" className="py-24 px-6" style={{ background: BG2 }} dir={dir}>
      <div className="max-w-4xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>{isAr ? 'مناطق الخدمة' : 'Service areas'}</p>
          <h2 className="font-display text-3xl md:text-4xl font-black mb-4" style={{ color: T }}>
            {isAr ? 'نخدم كل أحياء الرياض بالاستلام والتوصيل' : 'We serve every Riyadh district with pickup & delivery'}
          </h2>
          <p className="text-sm mb-8 leading-7" style={{ color: '#bdb8ad' }}>
            {isAr ? 'فرعنا في العزيزية جنوب الرياض، ونستلم قطعتك من موقعك في أي حي. ومن خارج الرياض نستقبلها بالشحن عبر أرامكس.' : 'Our branch is in Al Aziziyah, South Riyadh, and we collect your item from any district. From outside Riyadh we receive it by courier via Aramex.'}
          </p>
        </FadeIn>
        <ul className="flex flex-wrap justify-center gap-2 mb-5">
          <li><Link to={`${pre}/areas/riyadh`} className="inline-block rounded-full px-5 py-2 text-sm font-black" style={{ background: G, color: '#000' }}>{isAr ? 'كل أحياء الرياض' : 'All Riyadh districts'}</Link></li>
          {SECTORS.map((s) => <li key={s.slug}><Link to={`${pre}/areas/${s.slug}`} className="inline-block rounded-full px-4 py-2 text-xs font-bold" style={chip}>{isAr ? s.ar : s.en}</Link></li>)}
        </ul>
        <ul className="flex flex-wrap justify-center gap-2 mb-5">
          {top.map((d) => <li key={d.slug}><Link to={`${pre}/areas/${d.slug}`} className="inline-block rounded-full px-4 py-2 text-xs font-bold" style={chip}>{isAr ? `حي ${d.ar}` : d.en}</Link></li>)}
        </ul>
        <Link to={`${pre}/areas/saudi-arabia`} className="text-xs font-bold underline" style={{ color: GT }}>{isAr ? 'من خارج الرياض؟ أرسل قطعتك بالشحن من أي مدينة بالسعودية' : 'Outside Riyadh? Send your item by courier from anywhere in Saudi Arabia'}</Link>
      </div>
    </section>
  );
}

// ── الأسئلة الشائعة — نفس المصدر (src/lib/seo/siteData.js) اللي يغذّي
// FAQPage JSON-LD وllms.txt، فالإجابات للزائر ولمحركات الذكاء متطابقة.
// <details> الأصلي: يشتغل بدون JavaScript وكل الإجابات ظاهرة للزواحف.
function FaqSection() {
  const { lang, dir } = useLanguage();
  const items = FAQ[lang === 'ar' ? 'ar' : 'en'];
  return (
    <section id="faq" className="py-28 px-6" style={{ background: BG2 }} dir={dir}>
      <div className="max-w-3xl mx-auto">
        <FadeIn className="text-center mb-12">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>
            {lang === 'ar' ? 'أسئلة شائعة' : 'FAQ'}
          </p>
          <h2 className="font-display text-4xl font-black" style={{ color: T }}>
            {lang === 'ar' ? 'كل ما تحتاج تعرفه قبل التصليح' : 'Everything to know before your repair'}
          </h2>
        </FadeIn>
        <div className="space-y-3">
          {items.map((f, i) => (
            <details key={i} className="group rounded-2xl px-6 py-5 cursor-pointer"
              style={{ background: '#131315', border: `1px solid ${GB}0.2)` }}>
              <summary className="font-bold text-base list-none flex items-center justify-between gap-4" style={{ color: T }}>
                <h3 className="font-bold text-base">{f.q}</h3>
                <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45" style={{ color: GT }}>+</span>
              </summary>
              <p className="mt-3 text-sm leading-7" style={{ color: '#bdb8ad' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function BranchesSection() {
  const { t, dir } = useLanguage();
  const { data: siteData } = useSiteData();
  const branches = siteData?.branches || [];
  const items = branches.length ? branches : [{ name: t('home.branches.mainBranch'), city: t('home.branches.city'), address: t('home.branches.city'), phone: '0549678191' }];
  return (
    <section id="branches" className="py-28 px-6" style={{ background: '#0b0b0c' }} dir={dir}>
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-12">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: GT }}>{t('home.branches.eyebrow')}</p>
          <h2 className="font-display text-4xl font-black" style={{ color: T }}>{t('home.branches.title')}</h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((b, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <motion.div className="rounded-2xl p-6" style={{ background: GB + '0.04)', border: `1px solid ${GB}0.1)` }} whileHover={{ borderColor: GB + '0.3)', y: -4 }}>
                <h3 className="font-black text-lg mb-3" style={{ color: T }}>{b.name}</h3>
                <div className="space-y-2 text-sm" style={{ color: '#bdb8ad' }}>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" style={{ color: GT }} />{b.city}{b.address && ` — ${b.address}`}</div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" style={{ color: GT }} />{t('home.branches.hours')}</div>
                  {b.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" style={{ color: GT }} /><a href={`tel:${b.phone}`} className="hover:opacity-70">{b.phone}</a></div>}
                  {b.maps_url && (
                    <div className="pt-2">
                      <a href={b.maps_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{ background: GB + '0.08)', color: GT, border: `1px solid ${GB}0.15)` }}>
                        <MapPin className="w-3.5 h-3.5" /> {t('home.branches.viewMap') || 'فتح الموقع على الخريطة'}
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────
function Footer() {
  const { t, dir } = useLanguage();
  const { data: siteData } = useSiteData();
  const s = siteData?.settings || {};
  const crNumber = siteData?.crNumber;
  const instagram = s.social_instagram || 'https://www.instagram.com/ebra.kh8/';
  const whatsapp  = s.social_whatsapp  || '966549678191';
  const twitter   = s.social_twitter;
  const tiktok    = s.social_tiktok || 'https://www.tiktok.com/@cobblersriyad';
  const phone     = s.phone || '0549678191';

  const usefulLinks = [
    [t('common.footer.book'), '/book'],
    [t('common.footer.trackBooking'), '/my-bookings'],
    [t('common.footer.shop'), '/shop'],
    [t('common.footer.about'), '/about'],
    [t('common.footer.careers'), '/careers'],
    [t('common.footer.repairPolicy'), '/repair-policy'],
    [t('common.footer.shipping'), '/shipping-policy'],
    [t('common.footer.privacy'), '/privacy'],
  ];

  const socials = [
    { href: instagram, icon: Instagram, label: 'Instagram' },
    { href: tiktok, icon: TiktokIcon, label: 'TikTok' },
    { href: `https://wa.me/${whatsapp}`, icon: MessageCircle, label: 'WhatsApp' },
    ...(twitter ? [{ href: twitter, icon: Twitter, label: 'Twitter' }] : []),
  ];
  const box = { border: '1px solid rgba(236,232,223,.28)', color: '#ece8df' };
  return (
    <footer className="pt-20 pb-10 px-6" style={{ background: '#0b0b0c', borderTop: '1px solid #26262a' }} dir={dir}>
      <div className="max-w-7xl mx-auto text-start">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
          <div className="md:col-span-5">
            <img src="/images/cobblers-official-mark-white.png" alt={t('common.brand')} className="h-14 w-auto object-contain" loading="lazy" />
            <p className="mt-6 text-sm leading-loose max-w-sm" style={{ color: '#a8a398' }}>{t('common.footer.tagline')}</p>
            <div className="flex gap-2 mt-8">
              {socials.map((x, i) => (
                <a key={i} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={x.label}
                  className="w-11 h-11 flex items-center justify-center transition-colors hover:bg-[#ece8df] hover:text-[#0b0b0c]" style={box}>
                  <x.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          <div className="md:col-span-4">
            <h4 className="text-sm font-bold mb-6" style={{ color: '#ece8df' }}>{t('common.footer.linksTitle')}</h4>
            <ul className="space-y-3.5 text-sm" style={{ color: '#a8a398' }}>
              {usefulLinks.map(([label, to]) => (
                <li key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3">
            <h4 className="text-sm font-bold mb-6" style={{ color: '#ece8df' }}>{t('common.footer.customerServiceTitle')}</h4>
            <div className="flex gap-2">
              <a href={`tel:${phone}`} aria-label={t('common.footer.callUs')} className="w-11 h-11 flex items-center justify-center transition-colors hover:bg-[#ece8df] hover:text-[#0b0b0c]" style={box}><Phone className="w-4 h-4" /></a>
              <a href={`sms:${phone}`} aria-label={t('common.footer.textUs')} className="w-11 h-11 flex items-center justify-center transition-colors hover:bg-[#ece8df] hover:text-[#0b0b0c]" style={box}><Smartphone className="w-4 h-4" /></a>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-11 h-11 flex items-center justify-center transition-colors hover:bg-[#ece8df] hover:text-[#0b0b0c]" style={box}><MessageCircle className="w-4 h-4" /></a>
            </div>
            <p className="mt-4 text-sm" dir="ltr" style={{ color: '#a8a398', textAlign: dir === 'rtl' ? 'right' : 'left' }}>{phone}</p>
            {crNumber && (
              <div className="mt-8 flex items-center gap-3">
                <CleanLogo src="/images/cr-emblem.jpg" alt="السجل التجاري" className="w-12 h-12 object-contain" />
                <div className="text-sm" style={{ color: '#a8a398' }}>
                  <p className="mb-0.5">{t('common.footer.crLabel')}</p>
                  <p className="font-bold" style={{ color: '#ece8df' }}>{crNumber}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-16 pt-6" style={{ borderTop: '1px solid #26262a' }}>
          <p className="text-xs" style={{ color: '#8d8a82' }}>© {new Date().getFullYear()} {t('common.brand')}. {t('common.footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function BookingLanding() {
  useTrackVisit('/');
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  return (
    <div className="font-tajawal" style={{ scrollBehavior: 'smooth' }}>
      <Helmet>
        <html lang={isAr ? 'ar' : 'en'} />
        <title>{isAr
          ? HOME_SEO.title
          : HOME_SEO.en.title}</title>
        <meta name="description" content={isAr
          ? HOME_SEO.description
          : HOME_SEO.en.description} />
        <meta name="keywords" content={isAr
          ? 'إصلاح أحذية الرياض, تجديد حقائب جلدية, ترميم أحذية فاخرة, إسكافي الرياض, إبرة وخيط, تلميع أحذية, تبديل نعل, خياطة حذاء جلد, تنظيف حقائب جلدية, إصلاح سحاب حقيبة, إصلاح أحذية فاخرة, أفضل إسكافي في الرياض, إسكافي منزلي الرياض, اسكافي قريب مني, وين الاقي اسكافي زين, تصليح كوتشي, تصليح جزمة, تصليح صرمايه, صيانة احذيه, تصليح شنطة جلد, تصليح بسطار عسكري, صيانة بسطار الجيش, تبديل نعل بسطار عسكري, اصلاح جزمة عسكرية, تصليح بوت عسكري, بسطار الجيش السعودي, إصلاح أحذية العليا, إصلاح أحذية الملز, إصلاح أحذية النخيل, إصلاح أحذية حي السفارات, تصليح حذاء جلد أصلي, تلوين جلد, صيانة حقائب فاخرة, استلام وتوصيل إصلاح أحذية, حجز موعد إسكافي, shoe repair riyadh, leather bag repair riyadh, luxury shoe restoration, cobbler riyadh, shoe sole replacement riyadh, leather shine and polish, military boot repair riyadh'
          : 'shoe repair riyadh, cobbler riyadh, leather bag repair riyadh, luxury shoe restoration, shoe sole replacement riyadh, sneaker repair riyadh, military boot repair riyadh, army boot resole saudi arabia, handbag repair saudi arabia, leather care riyadh, best cobbler riyadh, shoe shine riyadh, luxury handbag restoration riyadh, zipper repair riyadh'} />
        <link rel="canonical" href="https://www.needlecobbler.com/" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta property="og:type" content="business.business" />
        <meta property="og:title" content={isAr ? 'إبرة وخيط الإسكافي | إصلاح الأحذية والحقائب الفاخرة - الرياض' : 'Ebra & Khait Cobbler | Luxury Shoe & Bag Repair — Riyadh'} />
        <meta property="og:description" content={isAr ? 'حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة. خدمة استلام وتوصيل في الرياض.' : 'Saudi craftsmen specialized in repairing luxury shoes and leather bags. Pickup & delivery service in Riyadh.'} />
        <meta property="og:url" content="https://www.needlecobbler.com/" />
        <meta property="og:image" content="https://www.needlecobbler.com/og-image.jpg" />
        <meta property="og:locale" content={isAr ? 'ar_SA' : 'en_US'} />
        <meta property="og:site_name" content={isAr ? 'إبرة وخيط الإسكافي' : 'Ebra & Khait Cobbler'} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={isAr ? 'إبرة وخيط الإسكافي | إصلاح الأحذية والحقائب الفاخرة' : 'Ebra & Khait Cobbler | Luxury Shoe & Bag Repair'} />
        <meta name="twitter:image" content="https://www.needlecobbler.com/og-image.jpg" />
        {/* البيانات المنظمة (LocalBusiness/FAQPage/WebSite) تُحقن بالـHTML الثابت عند البناء — scripts/seo-build.mjs */}
      </Helmet>
      <Navbar />
      <HeroSection />
      <TickerStrip />
      <ServicesSection />
      <BeforeAfterSection />
      <ReviewsSection />
      <RequestServiceSection />
      <AboutSection />
      <BrandsSection />
      <ServiceLinksSection />
      <AreasSection />
      <FaqSection />
      <BranchesSection />
      <TrackOrderSection />
      <Footer />
    </div>
  );
}
