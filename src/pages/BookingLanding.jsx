import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/supabaseApi';
import { supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import LogoMarquee from '@/components/LogoMarquee';
import {
  MapPin, Phone, Clock, Instagram, MessageCircle, Star, Award, Shield,
  Scissors, Sparkles, Package, ExternalLink, ChevronDown, Gem, ShoppingBag, Twitter, ArrowLeft, ArrowRight, Heart, CheckCircle, Menu, X, CalendarCheck
} from 'lucide-react';

// ── Palette ──────────────────────────────────────────────────────
const G   = '#C9A84C';   // Gold
const D   = '#1A0F00';   // Dark
const T   = '#F5EDD8';   // Text
const GB  = 'rgba(201,168,76,';

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
  const { t, dir } = useLanguage();
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
    { label: t('common.nav.story'), href: '#about' },
    { label: t('common.nav.customers'), href: '#reviews' },
    { label: t('common.nav.shop'), href: '/shop', to: true },
  ];

  return (
    <motion.nav className="fixed top-0 inset-x-0 z-50 px-6"
      initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      <div className={`max-w-7xl mx-auto mt-3 rounded-2xl px-5 h-14 flex items-center justify-between transition-all duration-500 ${scrolled ? 'shadow-2xl' : ''}`}
        style={{ background: scrolled ? 'rgba(10,6,0,0.92)' : 'rgba(10,6,0,0.5)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${scrolled ? GB + '0.2)' : GB + '0.08)'}` }}>
        <Link to="/" dir={dir}>
          <motion.div whileHover={{ scale: 1.03 }} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
              <Scissors className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-black text-sm" style={{ color: T }}>{t('common.brandShort')}</span>
          </motion.div>
        </Link>

        <div className="hidden md:flex items-center gap-6" dir={dir}>
          {links.map(l => l.to
            ? <Link key={l.label} to={l.href} className="text-sm font-medium transition-colors hover:text-yellow-400" style={{ color: `${GB}0.5)` }}>{l.label}</Link>
            : <a key={l.label} href={l.href} className="text-sm font-medium transition-colors hover:text-yellow-400" style={{ color: `${GB}0.5)` }}>{l.label}</a>
          )}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link to="/my-bookings" className="hidden md:block text-xs font-bold px-4 py-2 rounded-full transition-all"
            style={{ color: G, border: `1px solid ${GB}0.3)`, background: GB + '0.05)' }}>
            {t('common.nav.trackBooking')}
          </Link>
          <Link to="/book" className="hidden sm:block">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="text-xs font-black px-5 py-2 rounded-full text-black"
              style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)`, boxShadow: `0 4px 20px ${GB}0.4)` }}>
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
            style={{ background: 'rgba(10,6,0,0.96)', backdropFilter: 'blur(20px)', border: `1px solid ${GB}0.15)` }}
          >
            <div className="p-4 flex flex-col gap-1" dir={dir}>
              {links.map(l => l.to
                ? <Link key={l.label} to={l.href} onClick={() => setMobileOpen(false)}
                    className="text-sm font-medium py-3 px-3 rounded-xl transition-colors hover:bg-white/5" style={{ color: T }}>{l.label}</Link>
                : <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
                    className="text-sm font-medium py-3 px-3 rounded-xl transition-colors hover:bg-white/5" style={{ color: T }}>{l.label}</a>
              )}
              <Link to="/my-bookings" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 text-sm font-bold py-3 px-3 rounded-xl mt-1"
                style={{ color: G, border: `1px solid ${GB}0.25)` }}>
                <CalendarCheck className="w-4 h-4" />
                {t('common.nav.trackBooking')}
              </Link>
              <Link to="/book" onClick={() => setMobileOpen(false)}
                className="text-center text-sm font-black py-3 rounded-xl text-black mt-1"
                style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
                {t('common.nav.bookNow')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ── Hero ─────────────────────────────────────────────────────────
function HeroSection() {
  const { t, dir, lang } = useLanguage();
  const words = t('home.hero.words');
  const [wordIdx, setWordIdx] = useState(0);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 160]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);

  useEffect(() => {
    setWordIdx(0);
    const t2 = setInterval(() => setWordIdx(p => (p + 1) % words.length), 2200);
    return () => clearInterval(t2);
  }, [lang]);

  const stats = t('home.hero.stats');
  const statIcons = [Award, Heart, Shield];
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #1E0F00 0%, #0A0500 50%, #000 100%)' }}>

      {/* Animated orb — تم تخفيفها من 3 دوائر متحركة لدائرة واحدة لتقليل العبء على الرسوميات */}
      <GlowOrb x="75%" y="35%" size={500} color="rgba(201,168,76,0.10)" blur={130} />

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${GB}0.04) 1px, transparent 1px), linear-gradient(90deg, ${GB}0.04) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)'
      }} />

      {/* Diagonal decorative lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div key={i} className="absolute"
            style={{ left: `${-10 + i * 28}%`, top: 0, bottom: 0, width: 1, background: `linear-gradient(180deg, transparent, ${GB}0.06), transparent)`, transform: 'skewX(-15deg)' }}
            initial={{ scaleY: 0, originY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.5, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }} />
        ))}
      </div>

      <motion.div style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center min-h-[80vh]" dir={dir}>

          {/* ── Left: Text ── */}
          <div className="lg:col-span-3 space-y-8">
            {/* Eyebrow */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold tracking-widest"
              style={{ background: GB + '0.08)', border: `1px solid ${GB}0.25)`, color: G }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
                <Sparkles className="w-3.5 h-3.5" />
              </motion.div>
              {t('home.hero.eyebrow')}
            </motion.div>

            {/* Main headline */}
            <div>
              <motion.h1 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
                className="text-5xl md:text-6xl xl:text-7xl font-black leading-[1.1] mb-2" style={{ color: T }}>
                {t('home.hero.titleStart')}
              </motion.h1>

              {/* Animated word */}
              <div className="text-5xl md:text-6xl xl:text-7xl font-black leading-[1.1] mb-2 overflow-hidden" style={{ height: '1.15em' }}>
                <AnimatePresence mode="wait">
                  <motion.span key={lang + wordIdx}
                    initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="block" style={{ color: G }}>
                    {words[wordIdx]}
                  </motion.span>
                </AnimatePresence>
              </div>

              {t('home.hero.titleEnd') && (
                <motion.h1 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }}
                  className="text-5xl md:text-6xl xl:text-7xl font-black leading-[1.1]" style={{ color: T }}>
                  {t('home.hero.titleEnd')}
                </motion.h1>
              )}
            </div>

            {/* Desc */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}
              className="text-base md:text-lg leading-relaxed max-w-lg" style={{ color: `${GB}0.5)` }}>
              {t('home.hero.desc')}
            </motion.p>

            {/* Feature pills */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.5 }}
              className="flex flex-wrap gap-2">
              {t('home.hero.pills').map((p, i) => (
                <motion.span key={i} whileHover={{ scale: 1.05, borderColor: G }}
                  className="text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-default"
                  style={{ background: GB + '0.05)', border: `1px solid ${GB}0.15)`, color: `${GB}0.7)` }}>{p}</motion.span>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
              className="flex flex-wrap gap-4 items-center">
              <Link to="/book">
                <MagneticBtn className="group relative px-9 py-4 rounded-2xl font-black text-base text-black overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)`, boxShadow: `0 16px 50px ${GB}0.45)` }}>
                  <span className="relative z-10 flex items-center gap-2">
                    {t('home.hero.ctaPrimary')}
                    <motion.div animate={{ x: dir === 'rtl' ? [0, 4, 0] : [0, -4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ArrowIcon className="w-4 h-4" />
                    </motion.div>
                  </span>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #e8c96a, #C9A84C)' }} />
                </MagneticBtn>
              </Link>

              <Link to="/shop">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-2.5 px-7 py-4 rounded-2xl font-bold text-sm transition-all"
                  style={{ border: `1px solid ${GB}0.2)`, color: T, background: GB + '0.04)' }}>
                  <ShoppingBag className="w-4 h-4" style={{ color: G }} />
                  {t('home.hero.ctaSecondary')}
                </motion.div>
              </Link>
            </motion.div>

            {/* Stats Row */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.75 }}
              className="flex gap-8 pt-6 border-t" style={{ borderColor: GB + '0.1)' }}>
              {stats.map((s, i) => {
                const Icon = statIcons[i];
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" style={{ color: G }} />
                    <div>
                      <div className="text-xl font-black" style={{ color: G }}>
                        <AnimCounter target={s.num} />
                      </div>
                      <div className="text-xs" style={{ color: `${GB}0.35)` }}>{s.label}</div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>

          {/* ── Right: 3D Visual Card Stack ── */}
          <motion.div initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.1, delay: 0.3 }}
            className="lg:col-span-2 relative flex items-center justify-center" style={{ height: 520 }}>

            {/* Card stack */}
            {[
              { src: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', alt: 'إصلاح وترميم أحذية جلدية فاخرة في الرياض', rotate: -8, z: 0, x: -20, y: 20, scale: 0.88 },
              { src: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', alt: 'تجديد وتنظيف حقائب جلدية فاخرة', rotate: 4, z: 1, x: 15, y: 10, scale: 0.93 },
              { src: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', alt: 'ورشة إبرة وخيط الإسكافي المتخصصة في الرياض', priority: true, rotate: 0, z: 2, x: 0, y: 0, scale: 1 },
            ].map((card, i) => (
              <motion.div key={i} className="absolute rounded-3xl overflow-hidden shadow-2xl"
                style={{ width: 280, height: 360, zIndex: card.z, border: `1px solid ${GB}${0.08 + i * 0.08})` }}
                initial={{ rotate: card.rotate, x: card.x, y: card.y, scale: card.scale }}
                whileHover={i === 2 ? { scale: 1.03, rotate: -1, y: -8 } : {}}
                animate={{
                  rotate: card.rotate,
                  x: card.x,
                  y: [card.y, card.y - 6, card.y],
                  scale: card.scale
                }}
                transition={{ y: { duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 } }}>
                <img src={card.src} alt={card.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,5,0,0.7) 0%, transparent 60%)' }} />
              </motion.div>
            ))}

            {/* Floating badge — top right */}
            <motion.div
              animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-6 right-2 z-20 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs"
              style={{ background: 'rgba(10,5,0,0.88)', border: `1px solid ${GB}0.3)`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: `0 8px 30px ${GB}0.2)` }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
                <CheckCircle className="w-3.5 h-3.5 text-black" />
              </div>
              <div>
                <div className="font-black" style={{ color: T }}>{t('home.hero.badgeQuality')}</div>
                <div style={{ color: `${GB}0.4)` }}>{t('home.hero.badgeQualitySub')}</div>
              </div>
            </motion.div>

            {/* Floating badge — bottom left */}
            <motion.div
              animate={{ y: [0, 10, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="absolute bottom-10 left-0 z-20 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(10,5,0,0.88)', border: `1px solid ${GB}0.2)`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                {[...Array(5)].map((_, s) => <Star key={s} className="w-3 h-3 fill-current" style={{ color: G }} />)}
              </div>
              <div className="text-xs font-black" style={{ color: T }}>{t('home.hero.badgeRating')}</div>
              <div className="text-xs" style={{ color: `${GB}0.4)` }}>{t('home.hero.badgeRatingSub')}</div>
            </motion.div>

            {/* Live indicator */}
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute top-1/2 -left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(10,5,0,0.88)', border: `1px solid rgba(50,200,100,0.3)`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
              <motion.div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span style={{ color: '#22c55e', fontWeight: 700 }}>{t('home.hero.liveNow')}</span>
            </motion.div>

            {/* Gold glow under cards */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-20 blur-3xl rounded-full pointer-events-none"
              style={{ background: `${GB}0.2)` }} />
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ color: `${GB}0.2)` }}>
        <span className="text-xs tracking-widest">{t('home.hero.scrollHint')}</span>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </div>
    </section>
  );
}

// ── Ticker / Process Strip ────────────────────────────────────────
function TickerStrip() {
  const { t } = useLanguage();
  const items = t('home.ticker');
  return (
    <div className="py-4 overflow-hidden relative" style={{ background: `linear-gradient(90deg, ${D}, #2C1A00, ${D})`, borderTop: `1px solid ${GB}0.15)`, borderBottom: `1px solid ${GB}0.15)` }}>
      <div className="flex gap-0">
        {[0, 1].map(k => (
          <motion.div key={k} className="flex gap-10 shrink-0 pr-10"
            animate={{ x: ['0%', '-100%'] }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
            {items.map((item, i) => (
              <span key={i} className="whitespace-nowrap text-sm font-bold" style={{ color: G }}>{item}</span>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Services ─────────────────────────────────────────────────────
const SERVICE_META = [
  { icon: Scissors, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80' },
  { icon: Package, img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80' },
  { icon: Sparkles, img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80' },
];
const STEP_ICONS = [MessageCircle, Package, Scissors, CheckCircle];

function ServicesSection() {
  const { t, dir } = useLanguage();
  const services = t('home.services.items');
  const steps = t('home.services.steps');
  return (
    <section id="services" className="py-32 px-6" style={{ background: '#0A0500' }}>
      <div className="max-w-6xl mx-auto" dir={dir}>
        <FadeIn className="text-center mb-16">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>{t('home.services.eyebrow')}</p>
          <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: T }}>{t('home.services.title')}</h2>
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: `${GB}0.4)` }}>
            {t('home.services.desc')}
          </p>
          <div className="mt-6 w-24 h-0.5 mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <motion.div className="group rounded-3xl overflow-hidden h-full flex flex-col cursor-pointer"
                style={{ background: `rgba(255,255,255,0.02)`, border: `1px solid ${GB}0.08)` }}
                whileHover={{ y: -8, borderColor: `${GB}0.25)`, boxShadow: `0 30px 60px ${GB}0.15)` }}
                transition={{ duration: 0.35 }}>

                {/* Image */}
                <div className="relative overflow-hidden" style={{ height: 220 }}>
                  <motion.img src={SERVICE_META[i].img} alt={s.title + ' — إبرة وخيط الإسكافي'}
                    className="w-full h-full object-cover" loading="lazy"
                    whileHover={{ scale: 1.08 }} transition={{ duration: 0.6 }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #0A0500 100%)' }} />
                  {/* Price tag */}
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl text-xs font-black text-black"
                    style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>{s.price}</div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <span className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full text-xs font-bold w-fit"
                    style={{ background: GB + '0.1)', color: G, border: `1px solid ${GB}0.2)` }}>
                    {React.createElement(SERVICE_META[i].icon, { className: 'w-3 h-3' })}{s.tag}
                  </span>
                  <h3 className="text-xl font-black mb-2" style={{ color: T }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: `${GB}0.45)` }}>{s.desc}</p>
                  <Link to="/book">
                    <motion.div whileHover={{ gap: '16px' }} className="flex items-center gap-2 font-bold text-sm"
                      style={{ color: G }}>
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
          <div className="rounded-3xl p-8 md:p-12" style={{ background: 'rgba(201,168,76,0.04)', border: `1px solid ${GB}0.1)` }}>
            <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase text-center" style={{ color: G }}>{t('home.services.howItWorks')}</p>
            <h3 className="text-3xl font-black text-center mb-10" style={{ color: T }}>{t('home.services.howItWorksTitle')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {steps.map((step, i) => (
                <FadeIn key={i} delay={i * 0.1} className="text-center">
                  <div className="relative inline-flex mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                      style={{ background: `linear-gradient(135deg, ${GB}0.12), ${GB}0.04))`, border: `1px solid ${GB}0.2)` }}>
                      {React.createElement(STEP_ICONS[i], { className: 'w-6 h-6', style: { color: G } })}
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center text-black"
                      style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>{i + 1}</span>
                  </div>
                  <h4 className="font-black mb-1.5" style={{ color: T }}>{step.t}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: `${GB}0.4)` }}>{step.d}</p>
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
    <section id="before-after" className="py-32 px-6" style={{ background: '#060300' }}>
      <div className="max-w-6xl mx-auto" dir={dir}>
        <FadeIn className="text-center mb-16">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>{t('home.beforeAfter.eyebrow')}</p>
          <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: T }}>{t('home.beforeAfter.title')}</h2>
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: `${GB}0.4)` }}>
            {t('home.beforeAfter.desc')}
          </p>
          <div className="mt-6 w-24 h-0.5 mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {items.map((item, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${GB}0.12)`, background: 'rgba(255,255,255,0.02)' }}>
                <BeforeAfterSlider
                  beforeImage={item.before}
                  afterImage={item.after}
                  beforeLabel={dir === 'rtl' ? 'قبل' : 'Before'}
                  afterLabel={dir === 'rtl' ? 'بعد' : 'After'}
                />
                <div className="px-5 py-4 text-center">
                  <p className="font-black text-sm" style={{ color: T }}>{item.label}</p>
                  <p className="text-[11px] mt-1" style={{ color: `${GB}0.35)` }}>{t('home.beforeAfter.hint')}</p>
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
    <section id="request" className="py-32 px-6" style={{ background: '#060300' }}>
      <div className="max-w-5xl mx-auto" dir={dir}>
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>{t('home.request.eyebrow')}</p>
          <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: T }}>{t('home.request.title')}</h2>
          <p className="text-sm" style={{ color: `${GB}0.4)` }}>{t('home.request.desc')}</p>
        </FadeIn>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 rounded-3xl" style={{ background: GB + '0.05)', border: `1px solid ${GB}0.15)` }}>
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6 }}>
                <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: G }} />
              </motion.div>
              <h3 className="text-2xl font-black mb-2" style={{ color: T }}>{t('home.request.doneTitle')}</h3>
              <p style={{ color: `${GB}0.5)` }}>{t('home.request.doneDesc')}</p>
              <button onClick={() => setSent(false)} className="mt-6 text-sm underline" style={{ color: G }}>{t('home.request.sendAnother')}</button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-3xl p-8 md:p-12" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${GB}0.1)` }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {[['name', t('home.request.nameLabel'), t('home.request.namePh')], ['phone', t('home.request.phoneLabel'), '05XXXXXXXX']].map(([k, label, ph]) => (
                  <div key={k} className="space-y-2">
                    <label className="text-xs font-bold" style={{ color: `${GB}0.5)` }}>{label}</label>
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
                <label className="text-xs font-bold" style={{ color: `${GB}0.5)` }}>{t('home.request.serviceLabel')}</label>
                <select value={form.service} onChange={e => upd('service', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl outline-none text-sm"
                  style={{ background: GB + '0.04)', border: `1px solid ${GB}0.12)`, color: form.service ? T : `${GB}0.3)` }}>
                  <option value="">{t('home.request.chooseService')}</option>
                  {t('home.request.serviceOptions').map(s => (
                    <option key={s} value={s} style={{ background: '#0A0500' }}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="mb-8 space-y-2">
                <label className="text-xs font-bold" style={{ color: `${GB}0.5)` }}>{t('home.request.notesLabel')}</label>
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
                style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)`, boxShadow: `0 12px 40px ${GB}0.4)`, opacity: loading ? 0.7 : 1 }}>
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
    <section id="about" className="py-32 px-6" style={{ background: '#0A0500' }} dir={dir}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeIn className="grid grid-cols-2 gap-3">
            {[
              { src: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', alt: 'حرفي متخصص يصلح حقيبة جلدية فاخرة' },
              { src: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', alt: 'أدوات وخيوط ورشة إصلاح الأحذية' },
              { src: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', alt: 'ورشة إبرة وخيط الإسكافي في الرياض' },
              { src: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', alt: 'تبديل نعل حذاء جلدي فاخر' },
            ].map((img, i) => (
                <motion.div key={i} className={`rounded-2xl overflow-hidden ${i % 2 === 1 ? 'mt-6' : ''}`}
                  style={{ border: `1px solid ${GB}0.1)` }}
                  whileHover={{ scale: 1.03, borderColor: GB + '0.3)' }} transition={{ duration: 0.3 }}>
                  <img src={img.src} alt={img.alt} className="w-full h-44 object-cover" loading="lazy" />
                </motion.div>
              ))}
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-xs tracking-[0.5em] font-bold mb-4 uppercase" style={{ color: G }}>{t('home.about.eyebrow')}</p>
            <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight" style={{ color: T }}>
              {t('home.about.titleLine1')}<br /><span style={{ color: G }}>{t('home.about.titleLine2')}</span>
            </h2>
            <p className="leading-relaxed text-base mb-8" style={{ color: `${GB}0.45)` }}>
              {t('home.about.desc')}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {stats.map((s, i) => (
                <motion.div key={i} className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: GB + '0.05)', border: `1px solid ${GB}0.12)` }}
                  whileHover={{ borderColor: GB + '0.3)', scale: 1.02 }}>
                  {React.createElement(ABOUT_STAT_ICONS[i], { className: 'w-5 h-5 shrink-0', style: { color: G } })}
                  <div>
                    <div className="text-xl font-black" style={{ color: G }}><AnimCounter target={s.num} /></div>
                    <div className="text-xs" style={{ color: `${GB}0.35)` }}>{s.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <Link to="/about">
              <MagneticBtn className="px-8 py-3.5 rounded-2xl font-bold text-base text-black"
                style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)`, boxShadow: `0 8px 30px ${GB}0.3)` }}>
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
    <section className="py-32 px-6" style={{ background: '#060300' }} dir={dir}>
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>{t('home.reviews.eyebrow')}</p>
          <h2 className="text-4xl md:text-5xl font-black" style={{ color: T }}>{t('home.reviews.title')}</h2>
          <div className="mt-4 w-24 h-0.5 mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r, i) => (
            <FadeIn key={i} delay={i * 0.07}>
              <motion.div className="rounded-2xl p-6 flex flex-col gap-4 h-full cursor-pointer"
                animate={{ background: active === i ? GB + '0.07)' : 'rgba(255,255,255,0.02)', borderColor: active === i ? GB + '0.3)' : 'rgba(255,255,255,0.05)' }}
                style={{ border: '1px solid' }} whileHover={{ y: -4 }} onClick={() => setActive(i)}>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color: G }} />)}
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: `${GB}0.6)` }}>"{r.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-black shrink-0"
                    style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>{r.name[0]}</div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: T }}>{r.name}</p>
                    <p className="text-xs" style={{ color: `${GB}0.3)` }}>{r.service}</p>
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
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-public'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'sort_order'),
    staleTime: 5 * 60 * 1000,
  });
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
    <section className="py-20 px-6" style={{ background: '#0A0500', borderTop: `1px solid ${GB}0.08)`, borderBottom: `1px solid ${GB}0.08)` }}>
      <div className="max-w-5xl mx-auto" dir={dir}>
        <FadeIn className="text-center mb-12">
          <p className="text-xs tracking-[0.5em] font-bold mb-2 uppercase" style={{ color: G }}>{t('home.brands.eyebrow')}</p>
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
      // كان الاستعلام محدود بـ .limit(1).single() فيرجع طلب واحد فقط
      // حتى لو العميل عنده عدة طلبات مسجلة بنفس رقم الجوال — الآن
      // نجيب كل الطلبات المطابقة (بالرقم أو الجوال) ونعرضها كلها
      const { data, error } = await supabase.from('orders')
        .select('order_number,customer_name,status,item_type,created_at')
        .or(`order_number.eq.${code},customer_phone.eq.${code}`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setResults(data || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  return (
    <section className="py-28 px-6" style={{ background: '#060300' }} dir={dir}>
      <div className="max-w-2xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>{t('home.track.eyebrow')}</p>
          <h2 className="text-4xl font-black mb-3" style={{ color: T }}>{t('home.track.title')}</h2>
          <p className="text-sm mb-8" style={{ color: `${GB}0.4)` }}>{t('home.track.desc')}</p>
          <div className="flex gap-3 max-w-md mx-auto mb-6">
            <input value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder={t('home.track.placeholder')} dir="ltr"
              className="flex-1 px-4 py-3.5 rounded-2xl outline-none text-sm"
              style={{ background: GB + '0.04)', border: `1px solid ${GB}0.15)`, color: T }} />
            <MagneticBtn onClick={search}
              className="px-6 py-3.5 rounded-2xl font-black text-sm text-black"
              style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
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
                    <p className="text-xs text-right" style={{ color: `${GB}0.5)` }}>
                      {t('home.track.multipleFound') || `عدد الطلبات الموجودة: ${results.length}`}
                    </p>
                  )}
                  {results.map((r, i) => (
                    <motion.div key={r.order_number || i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl p-5 text-sm"
                      style={{ background: GB + '0.06)', border: `1px solid ${GB}0.2)` }}>
                      <div className="text-right space-y-2">
                        <div className="font-black text-base" style={{ color: G }}>{r.order_number}</div>
                        <div style={{ color: T }}>{t('home.track.customer')}: {r.customer_name}</div>
                        <div className="text-xl font-black" style={{ color: G }}>{STATUS[r.status] || r.status}</div>
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
function BranchesSection() {
  const { t, dir } = useLanguage();
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-public'],
    queryFn: () => base44.entities.Branch.filter({ is_active: true }, 'sort_order'),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const items = branches.length ? branches : [{ name: t('home.branches.mainBranch'), city: t('home.branches.city'), address: t('home.branches.city'), phone: '0549678191' }];
  return (
    <section id="branches" className="py-28 px-6" style={{ background: '#0A0500' }} dir={dir}>
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-12">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>{t('home.branches.eyebrow')}</p>
          <h2 className="text-4xl font-black" style={{ color: T }}>{t('home.branches.title')}</h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((b, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <motion.div className="rounded-2xl p-6" style={{ background: GB + '0.04)', border: `1px solid ${GB}0.1)` }} whileHover={{ borderColor: GB + '0.3)', y: -4 }}>
                <h3 className="font-black text-lg mb-3" style={{ color: T }}>{b.name}</h3>
                <div className="space-y-2 text-sm" style={{ color: `${GB}0.5)` }}>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" style={{ color: G }} />{b.city}{b.address && ` — ${b.address}`}</div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" style={{ color: G }} />{t('home.branches.hours')}</div>
                  {b.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" style={{ color: G }} /><a href={`tel:${b.phone}`} className="hover:text-yellow-400">{b.phone}</a></div>}
                  {b.maps_url && (
                    <div className="pt-2">
                      <a href={b.maps_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{ background: GB + '0.08)', color: G, border: `1px solid ${GB}0.15)` }}>
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
  const { data: settingsArr } = useQuery({
    queryKey: ['app-settings-public'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('social_instagram,social_whatsapp,social_twitter,phone,vat_number').limit(1);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const s = settingsArr?.[0] || {};
  const instagram = s.social_instagram || 'https://www.instagram.com/ebra.kh8/';
  const whatsapp  = s.social_whatsapp  || '966549678191';
  const twitter   = s.social_twitter;
  const phone     = s.phone || '0549678191';

  return (
    <footer className="py-16 px-6" style={{ background: '#060300', borderTop: `1px solid ${GB}0.08)` }} dir={dir}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
                <Scissors className="w-4 h-4 text-black" />
              </div>
              <h3 className="text-xl font-black" style={{ color: T }}>{t('common.brand')}</h3>
            </div>
            <p className="text-sm leading-relaxed max-w-xs mb-5" style={{ color: `${GB}0.2)` }}>
              {t('common.footer.tagline')}
            </p>
            <div className="flex gap-3">
              {[
                { href: instagram, icon: Instagram, color: '#E1306C', label: 'Instagram' },
                { href: `https://wa.me/${whatsapp}`, icon: MessageCircle, color: '#25D366', label: 'WhatsApp' },
                ...(twitter ? [{ href: twitter, icon: Twitter, color: G, label: 'Twitter' }] : []),
              ].map((social, i) => (
                <motion.a key={i} href={social.href} target="_blank" rel="noopener noreferrer"
                  aria-label={social.label} whileHover={{ scale: 1.15, y: -2 }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: GB + '0.05)', border: `1px solid ${GB}0.12)` }}>
                  <social.icon className="w-4 h-4" style={{ color: social.color }} />
                </motion.a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs tracking-widest font-bold mb-5 uppercase" style={{ color: G }}>{t('common.footer.linksTitle')}</h4>
            <ul className="space-y-3 text-sm" style={{ color: `${GB}0.3)` }}>
              {[[t('common.footer.book'), '/book'], [t('common.footer.trackBooking'), '/my-bookings'], [t('common.footer.shop'), '/shop'], [t('common.footer.about'), '/about'], [t('common.footer.repairPolicy'), '/repair-policy']].map(([label, to]) => (
                <li key={to}><Link to={to} className="hover:text-yellow-400 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs tracking-widest font-bold mb-5 uppercase" style={{ color: G }}>{t('common.footer.legalTitle')}</h4>
            <ul className="space-y-3 text-sm" style={{ color: `${GB}0.3)` }}>
              {[[t('common.footer.privacy'), '/privacy'], [t('common.footer.shipping'), '/shipping-policy']].map(([label, to]) => (
                <li key={to}><Link to={to} className="hover:text-yellow-400 transition-colors">{label}</Link></li>
              ))}
              <li><a href={`tel:${phone}`} className="hover:text-yellow-400 transition-colors">{phone}</a></li>
              <li><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition-colors">{t('common.footer.whatsapp')}</a></li>
              {s.vat_number && <li className="pt-1" style={{ color: `${GB}0.25)` }}>الرقم الضريبي: {s.vat_number}</li>}
            </ul>
          </div>
        </div>

        <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: GB + '0.08)' }}>
          <p className="text-sm" style={{ color: `${GB}0.12)` }}>© {new Date().getFullYear()} {t('common.brand')}. {t('common.footer.rights')}</p>
          <div className="flex gap-4 text-xs" style={{ color: `${GB}0.15)` }}>
            <Link to="/privacy" className="hover:text-yellow-400 transition-colors">{t('common.footer.privacy')}</Link>
            <Link to="/shipping-policy" className="hover:text-yellow-400 transition-colors">{t('common.footer.shipping')}</Link>
            <Link to="/about" className="hover:text-yellow-400 transition-colors">{t('common.footer.about')}</Link>
          </div>
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
          ? 'إبرة وخيط الإسكافي | إصلاح وتجديد الأحذية والحقائب الجلدية والبسطار العسكري في الرياض'
          : 'Ebra & Khait Cobbler | Luxury Shoe & Bag Repair in Riyadh, Saudi Arabia'}</title>
        <meta name="description" content={isAr
          ? 'إبرة وخيط الإسكافي — حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة والبسطار العسكري في الرياض. خدمات ترميم وتلميع وتغيير النعال لأرقى الماركات. احجز موعدك الآن!'
          : 'Ebra & Khait Cobbler — Saudi craftsmen specialized in repairing and restoring luxury shoes, leather bags, sneakers, and military boots in Riyadh. Restoration, polishing, sole replacement for top brands. Book now!'} />
        <meta name="keywords" content={isAr
          ? 'إصلاح أحذية الرياض, تجديد حقائب جلدية, ترميم أحذية فاخرة, إسكافي الرياض, إبرة وخيط, تلميع أحذية, تبديل نعل, خياطة حذاء جلد, تنظيف حقائب جلدية, إصلاح سحاب حقيبة, إصلاح أحذية فاخرة, أفضل إسكافي في الرياض, إسكافي منزلي الرياض, اسكافي قريب مني, وين الاقي اسكافي زين, تصليح كوتشي, تصليح جزمة, تصليح صرمايه, صيانة احذيه, تصليح شنطة جلد, تصليح بسطار عسكري, صيانة بسطار الجيش, تبديل نعل بسطار عسكري, اصلاح جزمة عسكرية, تصليح بوت عسكري, بسطار الجيش السعودي, إصلاح أحذية العليا, إصلاح أحذية الملز, إصلاح أحذية النخيل, إصلاح أحذية حي السفارات, تصليح حذاء جلد أصلي, تلوين جلد, صيانة حقائب فاخرة, استلام وتوصيل إصلاح أحذية, حجز موعد إسكافي, shoe repair riyadh, leather bag repair riyadh, luxury shoe restoration, cobbler riyadh, shoe sole replacement riyadh, leather shine and polish, military boot repair riyadh'
          : 'shoe repair riyadh, cobbler riyadh, leather bag repair riyadh, luxury shoe restoration, shoe sole replacement riyadh, sneaker repair riyadh, military boot repair riyadh, army boot resole saudi arabia, handbag repair saudi arabia, leather care riyadh, best cobbler riyadh, shoe shine riyadh, luxury handbag restoration riyadh, zipper repair riyadh'} />
        <link rel="canonical" href="https://needlecobbler.com/" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta property="og:type" content="business.business" />
        <meta property="og:title" content={isAr ? 'إبرة وخيط الإسكافي | إصلاح الأحذية والحقائب الفاخرة - الرياض' : 'Ebra & Khait Cobbler | Luxury Shoe & Bag Repair — Riyadh'} />
        <meta property="og:description" content={isAr ? 'حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة. خدمة استلام وتوصيل في الرياض.' : 'Saudi craftsmen specialized in repairing luxury shoes and leather bags. Pickup & delivery service in Riyadh.'} />
        <meta property="og:url" content="https://needlecobbler.com/" />
        <meta property="og:image" content="https://needlecobbler.com/og-image.jpg" />
        <meta property="og:locale" content={isAr ? 'ar_SA' : 'en_US'} />
        <meta property="og:site_name" content={isAr ? 'إبرة وخيط الإسكافي' : 'Ebra & Khait Cobbler'} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={isAr ? 'إبرة وخيط الإسكافي | إصلاح الأحذية والحقائب الفاخرة' : 'Ebra & Khait Cobbler | Luxury Shoe & Bag Repair'} />
        <meta name="twitter:image" content="https://needlecobbler.com/og-image.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "إبرة وخيط الإسكافي",
          "alternateName": "Ebra & Khait Cobbler",
          "url": "https://needlecobbler.com",
          "telephone": "+966549678191",
          "priceRange": "$$",
          "address": { "@type": "PostalAddress", "addressLocality": "الرياض", "addressCountry": "SA" },
          "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification", "dayOfWeek": ["Saturday","Sunday","Monday","Tuesday","Wednesday","Thursday"], "opens": "09:00", "closes": "22:00" }],
          "sameAs": ["https://www.instagram.com/ebra.kh8/"]
        })}</script>
      </Helmet>
      <Navbar />
      <HeroSection />
      <TickerStrip />
      <ServicesSection />
      <BeforeAfterSection />
      <RequestServiceSection />
      <BrandsSection />
      <AboutSection />
      <ReviewsSection />
      <TrackOrderSection />
      <BranchesSection />
      <Footer />
    </div>
  );
}
