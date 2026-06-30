import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/supabaseApi';
import { supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  MapPin, Phone, Clock, Instagram, MessageCircle, Star, Award, Shield,
  Scissors, Sparkles, Package, ExternalLink, ChevronDown, Gem, ShoppingBag, Twitter, ArrowLeft, Heart, CheckCircle
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

// ── Floating Particle ─────────────────────────────────────────────
function Particle({ style }) {
  return (
    <motion.div className="absolute rounded-full pointer-events-none" style={style}
      animate={{ y: [-20, 20, -20], opacity: [0.3, 0.8, 0.3], scale: [1, 1.2, 1] }}
      transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 4, ease: 'easeInOut' }} />
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
  const suffix = target.endsWith('%') ? '%' : target.includes('يد') ? '' : '';
  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

// ── Navbar ────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const links = [
    { label: 'الخدمات', href: '#services' },
    { label: 'قصتنا', href: '#about' },
    { label: 'العملاء', href: '#reviews' },
    { label: 'المتجر', href: '/shop', to: true },
  ];

  return (
    <motion.nav className="fixed top-0 inset-x-0 z-50 px-6"
      initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      <div className={`max-w-7xl mx-auto mt-3 rounded-2xl px-5 h-14 flex items-center justify-between transition-all duration-500 ${scrolled ? 'shadow-2xl' : ''}`}
        style={{ background: scrolled ? 'rgba(10,6,0,0.92)' : 'rgba(10,6,0,0.5)', backdropFilter: 'blur(20px)', border: `1px solid ${scrolled ? GB + '0.2)' : GB + '0.08)'}` }}>
        <Link to="/" dir="rtl">
          <motion.div whileHover={{ scale: 1.03 }} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
              <Scissors className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-black text-sm" style={{ color: T }}>إبرة وخيط</span>
          </motion.div>
        </Link>

        <div className="hidden md:flex items-center gap-6" dir="rtl">
          {links.map(l => l.to
            ? <Link key={l.label} to={l.href} className="text-sm font-medium transition-colors hover:text-yellow-400" style={{ color: `${GB}0.5)` }}>{l.label}</Link>
            : <a key={l.label} href={l.href} className="text-sm font-medium transition-colors hover:text-yellow-400" style={{ color: `${GB}0.5)` }}>{l.label}</a>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/my-bookings" className="hidden md:block text-xs font-bold px-4 py-2 rounded-full transition-all"
            style={{ color: G, border: `1px solid ${GB}0.3)`, background: GB + '0.05)' }}>
            تتبع حجزي
          </Link>
          <Link to="/book">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="text-xs font-black px-5 py-2 rounded-full text-black"
              style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)`, boxShadow: `0 4px 20px ${GB}0.4)` }}>
              احجز الآن
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

// ── Hero ─────────────────────────────────────────────────────────
const WORDS = ['الأحذية', 'الحقائب', 'الجلديات', 'الفاخرة'];

function HeroSection() {
  const [wordIdx, setWordIdx] = useState(0);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 160]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const particles = Array.from({ length: 18 }, (_, i) => ({
    width:  4 + Math.random() * 6,
    height: 4 + Math.random() * 6,
    left:   `${5 + Math.random() * 90}%`,
    top:    `${10 + Math.random() * 80}%`,
    background: i % 3 === 0 ? G : i % 3 === 1 ? 'rgba(255,200,80,0.5)' : 'rgba(180,120,30,0.4)',
  }));

  useEffect(() => {
    const t = setInterval(() => setWordIdx(p => (p + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #1E0F00 0%, #0A0500 50%, #000 100%)' }}>

      {/* Animated orbs */}
      <GlowOrb x="75%" y="35%" size={600} color="rgba(201,168,76,0.12)" blur={150} />
      <GlowOrb x="15%" y="70%" size={400} color="rgba(180,90,20,0.10)" blur={120} />
      <GlowOrb x="50%" y="10%" size={300} color="rgba(201,168,76,0.07)" blur={100} />

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${GB}0.04) 1px, transparent 1px), linear-gradient(90deg, ${GB}0.04) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)'
      }} />

      {/* Floating gold particles */}
      {particles.map((p, i) => <Particle key={i} style={p} />)}

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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center min-h-[80vh]" dir="rtl">

          {/* ── Left: Text ── */}
          <div className="lg:col-span-3 space-y-8">
            {/* Eyebrow */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold tracking-widest"
              style={{ background: GB + '0.08)', border: `1px solid ${GB}0.25)`, color: G }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
                <Sparkles className="w-3.5 h-3.5" />
              </motion.div>
              حرفيون سعوديون أصيلون — الرياض
            </motion.div>

            {/* Main headline */}
            <div>
              <motion.h1 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
                className="text-5xl md:text-6xl xl:text-7xl font-black leading-[1.1] mb-2" style={{ color: T }}>
                نُعيد روح
              </motion.h1>

              {/* Animated word */}
              <div className="text-5xl md:text-6xl xl:text-7xl font-black leading-[1.1] mb-2 overflow-hidden" style={{ height: '1.15em' }}>
                <AnimatePresence mode="wait">
                  <motion.span key={wordIdx}
                    initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="block" style={{ color: G }}>
                    {WORDS[wordIdx]}
                  </motion.span>
                </AnimatePresence>
              </div>

              <motion.h1 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }}
                className="text-5xl md:text-6xl xl:text-7xl font-black leading-[1.1]" style={{ color: T }}>
                الفاخرة
              </motion.h1>
            </div>

            {/* Desc */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}
              className="text-base md:text-lg leading-relaxed max-w-lg" style={{ color: `${GB}0.5)` }}>
              كل قطعة تحكي قصة. نحن نُعيد كتابة فصلها الجديد بأيدٍ سعودية متمرسة وتقنيات عالمية فاخرة.
            </motion.p>

            {/* Feature pills */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.5 }}
              className="flex flex-wrap gap-2">
              {['✦ استلام من موقعك', '✦ ضمان كامل', '✦ أكثر من 20 علامة فاخرة', '✦ إنجاز خلال 48 ساعة'].map((t, i) => (
                <motion.span key={i} whileHover={{ scale: 1.05, borderColor: G }}
                  className="text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-default"
                  style={{ background: GB + '0.05)', border: `1px solid ${GB}0.15)`, color: `${GB}0.7)` }}>{t}</motion.span>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
              className="flex flex-wrap gap-4 items-center">
              <Link to="/book">
                <MagneticBtn className="group relative px-9 py-4 rounded-2xl font-black text-base text-black overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)`, boxShadow: `0 16px 50px ${GB}0.45)` }}>
                  <span className="relative z-10 flex items-center gap-2">
                    ابدأ رحلة الترميم
                    <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ArrowLeft className="w-4 h-4" />
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
                  تسوق الآن
                </motion.div>
              </Link>
            </motion.div>

            {/* Stats Row */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.75 }}
              className="flex gap-8 pt-6 border-t" style={{ borderColor: GB + '0.1)' }}>
              {[
                { num: '+20', label: 'سنة خبرة', icon: Award },
                { num: '+5000', label: 'عميل سعيد', icon: Heart },
                { num: '100%', label: 'ضمان الجودة', icon: Shield },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <s.icon className="w-4 h-4 shrink-0" style={{ color: G }} />
                  <div>
                    <div className="text-xl font-black" style={{ color: G }}>
                      <AnimCounter target={s.num} />
                    </div>
                    <div className="text-xs" style={{ color: `${GB}0.35)` }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: 3D Visual Card Stack ── */}
          <motion.div initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.1, delay: 0.3 }}
            className="lg:col-span-2 relative flex items-center justify-center" style={{ height: 520 }}>

            {/* Card stack */}
            {[
              { src: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', rotate: -8, z: 0, x: -20, y: 20, scale: 0.88 },
              { src: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', rotate: 4, z: 1, x: 15, y: 10, scale: 0.93 },
              { src: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', rotate: 0, z: 2, x: 0, y: 0, scale: 1 },
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
                <img src={card.src} alt="إبرة وخيط الإسكافي" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,5,0,0.7) 0%, transparent 60%)' }} />
              </motion.div>
            ))}

            {/* Floating badge — top right */}
            <motion.div
              animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-6 right-2 z-20 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs"
              style={{ background: 'rgba(10,5,0,0.88)', border: `1px solid ${GB}0.3)`, backdropFilter: 'blur(12px)', boxShadow: `0 8px 30px ${GB}0.2)` }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
                <CheckCircle className="w-3.5 h-3.5 text-black" />
              </div>
              <div>
                <div className="font-black" style={{ color: T }}>جودة مضمونة</div>
                <div style={{ color: `${GB}0.4)` }}>ضمان كامل على كل خدمة</div>
              </div>
            </motion.div>

            {/* Floating badge — bottom left */}
            <motion.div
              animate={{ y: [0, 10, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="absolute bottom-10 left-0 z-20 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(10,5,0,0.88)', border: `1px solid ${GB}0.2)`, backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                {[...Array(5)].map((_, s) => <Star key={s} className="w-3 h-3 fill-current" style={{ color: G }} />)}
              </div>
              <div className="text-xs font-black" style={{ color: T }}>تقييم 5 نجوم</div>
              <div className="text-xs" style={{ color: `${GB}0.4)` }}>+500 تقييم حقيقي</div>
            </motion.div>

            {/* Live indicator */}
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute top-1/2 -left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(10,5,0,0.88)', border: `1px solid rgba(50,200,100,0.3)`, backdropFilter: 'blur(12px)' }}>
              <motion.div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span style={{ color: '#22c55e', fontWeight: 700 }}>متاح الآن</span>
            </motion.div>

            {/* Gold glow under cards */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-20 blur-3xl rounded-full pointer-events-none"
              style={{ background: `${GB}0.2)` }} />
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ color: `${GB}0.2)` }}>
        <span className="text-xs tracking-widest">اكتشف أكثر</span>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </div>
    </section>
  );
}

// ── Ticker / Process Strip ────────────────────────────────────────
const TICKER_ITEMS = [
  '✦ استلام من موقعك', '✦ ترميم احترافي', '✦ تسليم لبابك', '✦ ضمان كامل',
  '✦ أكثر من 20 علامة فاخرة', '✦ تقنيات أوروبية', '✦ أيدٍ سعودية', '✦ إنجاز في 48 ساعة',
];
function TickerStrip() {
  return (
    <div className="py-4 overflow-hidden relative" style={{ background: `linear-gradient(90deg, ${D}, #2C1A00, ${D})`, borderTop: `1px solid ${GB}0.15)`, borderBottom: `1px solid ${GB}0.15)` }}>
      <div className="flex gap-0">
        {[0, 1].map(k => (
          <motion.div key={k} className="flex gap-10 shrink-0 pr-10"
            animate={{ x: ['0%', '-100%'] }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
            {TICKER_ITEMS.map((item, i) => (
              <span key={i} className="whitespace-nowrap text-sm font-bold" style={{ color: G }}>{item}</span>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Services Data ─────────────────────────────────────────────────
const SERVICES = [
  { title: 'ترميم الأحذية', tag: 'الأكثر طلباً', icon: Scissors, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', desc: 'نعال، خياطة، تلميع — كل شيء يعود لأحسن مما كان. نستخدم مواد إيطالية أصيلة.', price: 'من 80 ر.س' },
  { title: 'تجديد الحقائب', tag: 'خبرة 20 عاماً', icon: Package, img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', desc: 'هيرمس، لويس فيتون، شانيل — نُجدد حقيبتك وتعود كأنها للتو من المحل.', price: 'من 150 ر.س' },
  { title: 'تلميع وتلوين', tag: 'إيطالي', icon: Sparkles, img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', desc: 'ألوان ثابتة وعميقة بتقنيات أوروبية حديثة. البريق الأصلي يعود كما كان.', price: 'من 50 ر.س' },
];

function ServicesSection() {
  return (
    <section id="services" className="py-32 px-6" style={{ background: '#0A0500' }}>
      <div className="max-w-6xl mx-auto" dir="rtl">
        <FadeIn className="text-center mb-16">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>خدمات المشغل</p>
          <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: T }}>مجموعة متكاملة من الخدمات</h2>
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: `${GB}0.4)` }}>
            نستخدم أجود الخامات العالمية وأحدث التقنيات لإعادة بريق مقتنياتك الثمينة
          </p>
          <div className="mt-6 w-24 h-0.5 mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SERVICES.map((s, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <motion.div className="group rounded-3xl overflow-hidden h-full flex flex-col cursor-pointer"
                style={{ background: `rgba(255,255,255,0.02)`, border: `1px solid ${GB}0.08)` }}
                whileHover={{ y: -8, borderColor: `${GB}0.25)`, boxShadow: `0 30px 60px ${GB}0.15)` }}
                transition={{ duration: 0.35 }}>

                {/* Image */}
                <div className="relative overflow-hidden" style={{ height: 220 }}>
                  <motion.img src={s.img} alt={s.title + ' — إبرة وخيط الإسكافي'}
                    className="w-full h-full object-cover"
                    whileHover={{ scale: 1.08 }} transition={{ duration: 0.6 }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #0A0500 100%)' }} />
                  {/* Price tag */}
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl text-xs font-black text-black"
                    style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>{s.price}</div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <span className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full text-xs font-bold w-fit"
                    style={{ background: GB + '0.1)', color: G, border: `1px solid ${GB}0.2)` }}>
                    <s.icon className="w-3 h-3" />{s.tag}
                  </span>
                  <h3 className="text-xl font-black mb-2" style={{ color: T }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: `${GB}0.45)` }}>{s.desc}</p>
                  <Link to="/book">
                    <motion.div whileHover={{ gap: '16px' }} className="flex items-center gap-2 font-bold text-sm"
                      style={{ color: G }}>
                      <span>احجز هذه الخدمة</span>
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
            <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase text-center" style={{ color: G }}>كيف يعمل</p>
            <h3 className="text-3xl font-black text-center mb-10" style={{ color: T }}>أربع خطوات — وقطعتك كالجديدة</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { n: '01', t: 'التواصل', d: 'أرسل صورة لقطعتك وسنقيّمها مجاناً خلال ساعة', icon: MessageCircle },
                { n: '02', t: 'الاستلام', d: 'مندوبنا يستلم من موقعك مباشرة في الرياض', icon: Package },
                { n: '03', t: 'الإصلاح', d: 'فريقنا يبدأ العمل فور الاستلام ويبلغك بكل مرحلة', icon: Scissors },
                { n: '04', t: 'التسليم', d: 'نوصل قطعتك كالجديدة مع ضمان كامل على الخدمة', icon: CheckCircle },
              ].map((step, i) => (
                <FadeIn key={i} delay={i * 0.1} className="text-center">
                  <div className="relative inline-flex mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                      style={{ background: `linear-gradient(135deg, ${GB}0.12), ${GB}0.04))`, border: `1px solid ${GB}0.2)` }}>
                      <step.icon className="w-6 h-6" style={{ color: G }} />
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

// ── Request Service ───────────────────────────────────────────────
function RequestServiceSection() {
  const [form, setForm] = useState({ name: '', phone: '', service: '', notes: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.phone) return;
    setLoading(true);
    try {
      await supabase.from('bookings').insert({
        customer_name: form.name, customer_phone: form.phone,
        notes: `الخدمة: ${form.service}\n${form.notes}`, status: 'pending',
      });
      setSent(true);
    } catch { setSent(true); }
    finally { setLoading(false); }
  };

  return (
    <section id="request" className="py-32 px-6" style={{ background: '#060300' }}>
      <div className="max-w-5xl mx-auto" dir="rtl">
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>اطلب خدمة</p>
          <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: T }}>نتواصل معك فوراً</h2>
          <p className="text-sm" style={{ color: `${GB}0.4)` }}>أترك بياناتك وسيتواصل معك فريقنا خلال ساعة</p>
        </FadeIn>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 rounded-3xl" style={{ background: GB + '0.05)', border: `1px solid ${GB}0.15)` }}>
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6 }}>
                <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: G }} />
              </motion.div>
              <h3 className="text-2xl font-black mb-2" style={{ color: T }}>تم الإرسال!</h3>
              <p style={{ color: `${GB}0.5)` }}>سيتواصل معك فريقنا قريباً</p>
              <button onClick={() => setSent(false)} className="mt-6 text-sm underline" style={{ color: G }}>إرسال طلب آخر</button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-3xl p-8 md:p-12" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${GB}0.1)` }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {[['name', 'الاسم الكريم', 'اسمك...'], ['phone', 'رقم الجوال', '05XXXXXXXX']].map(([k, label, ph]) => (
                  <div key={k} className="space-y-2">
                    <label className="text-xs font-bold" style={{ color: `${GB}0.5)` }}>{label}</label>
                    <input value={form[k]} onChange={e => upd(k, e.target.value)}
                      placeholder={ph} dir={k === 'phone' ? 'ltr' : 'rtl'}
                      className="w-full px-4 py-3.5 rounded-xl outline-none text-sm transition-all"
                      style={{ background: GB + '0.04)', border: `1px solid ${GB}0.12)`, color: T }}
                      onFocus={e => e.target.style.borderColor = GB + '0.4)'}
                      onBlur={e => e.target.style.borderColor = GB + '0.12)'} />
                  </div>
                ))}
              </div>
              <div className="mb-5 space-y-2">
                <label className="text-xs font-bold" style={{ color: `${GB}0.5)` }}>نوع الخدمة</label>
                <select value={form.service} onChange={e => upd('service', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl outline-none text-sm"
                  style={{ background: GB + '0.04)', border: `1px solid ${GB}0.12)`, color: form.service ? T : `${GB}0.3)` }}>
                  <option value="">اختر الخدمة</option>
                  {['ترميم أحذية', 'تجديد حقيبة', 'تلميع وتلوين', 'إصلاح خياطة', 'تنظيف عميق', 'استشارة مجانية'].map(s => (
                    <option key={s} value={s} style={{ background: '#0A0500' }}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="mb-8 space-y-2">
                <label className="text-xs font-bold" style={{ color: `${GB}0.5)` }}>تفاصيل إضافية (اختياري)</label>
                <textarea value={form.notes} onChange={e => upd('notes', e.target.value)}
                  placeholder="صف قطعتك أو أي تفاصيل تريد إضافتها..." rows={3}
                  className="w-full px-4 py-3.5 rounded-xl outline-none text-sm resize-none"
                  style={{ background: GB + '0.04)', border: `1px solid ${GB}0.12)`, color: T }} />
              </div>
              <MagneticBtn onClick={submit}
                className="w-full py-4 rounded-2xl font-black text-base text-black transition-all"
                style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)`, boxShadow: `0 12px 40px ${GB}0.4)`, opacity: loading ? 0.7 : 1 }}>
                {loading ? '⏳ جارٍ الإرسال...' : '✦ أرسل طلبك الآن'}
              </MagneticBtn>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ── About ─────────────────────────────────────────────────────────
function AboutSection() {
  const stats = [
    { icon: Award, num: '+20', label: 'سنة خبرة' },
    { icon: Star, num: '+5000', label: 'عميل راضٍ' },
    { icon: Shield, num: '100%', label: 'ضمان الجودة' },
    { icon: Gem, num: '+20', label: 'علامة فاخرة' },
  ];
  return (
    <section id="about" className="py-32 px-6" style={{ background: '#0A0500' }} dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeIn className="grid grid-cols-2 gap-3">
            {['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
              'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80',
              'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',
              'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80']
              .map((src, i) => (
                <motion.div key={i} className={`rounded-2xl overflow-hidden ${i % 2 === 1 ? 'mt-6' : ''}`}
                  style={{ border: `1px solid ${GB}0.1)` }}
                  whileHover={{ scale: 1.03, borderColor: GB + '0.3)' }} transition={{ duration: 0.3 }}>
                  <img src={src} alt="إبرة وخيط الإسكافي — ورشة الحرفة" className="w-full h-44 object-cover" />
                </motion.div>
              ))}
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-xs tracking-[0.5em] font-bold mb-4 uppercase" style={{ color: G }}>قصتنا</p>
            <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight" style={{ color: T }}>
              من حبنا للجلد<br /><span style={{ color: G }}>وُلدت الحرفة</span>
            </h2>
            <p className="leading-relaxed text-base mb-8" style={{ color: `${GB}0.45)` }}>
              إبرة وخيط الإسكافي براند سعودي أصيل من قلب الرياض. نجمع بين عراقة الحرفة اليدوية وأحدث التقنيات للمحافظة على مقتنياتكم الثمينة. خبرة تمتد لأكثر من عقدين، وآلاف العملاء الذين وثقوا بأيدينا.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {stats.map((s, i) => (
                <motion.div key={i} className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: GB + '0.05)', border: `1px solid ${GB}0.12)` }}
                  whileHover={{ borderColor: GB + '0.3)', scale: 1.02 }}>
                  <s.icon className="w-5 h-5 shrink-0" style={{ color: G }} />
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
                تعرف علينا أكثر ✦
              </MagneticBtn>
            </Link>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ── Reviews ───────────────────────────────────────────────────────
const REVIEWS = [
  { name: 'محمد العنزي', rating: 5, text: 'حضرت بحذاء كعبه انكسر وكنت مأيوس منه، رجع أحسن من الأول! الشغل نظيف جداً والسعر معقول.', service: 'إصلاح كعب', initials: 'م' },
  { name: 'سارة الشمري', rating: 5, text: 'حقيبتي الـ LV كانت تحتاج ترميم في المقبض، خلوها تطلع وكأنها جديدة. الدقة في التفاصيل لا توصف!', service: 'ترميم حقيبة فاخرة', initials: 'س' },
  { name: 'فهد الدوسري', rating: 5, text: 'أحذيتي الجلدية كانت تحتاج تلميع وإعادة تلوين. النتيجة مذهلة، اللون طلع ثابت وعميق.', service: 'تلميع وإعادة تلوين', initials: 'ف' },
  { name: 'نورة القحطاني', rating: 5, text: 'جبت شنطة كانت مقطوعة من الجانب، صلحوها بخيط ذهبي وطلعت أجمل! ما توقعت الشغل يطلع كذا.', service: 'خياطة وترميم', initials: 'ن' },
  { name: 'عبدالله المطيري', rating: 5, text: 'قديم في التعامل مع إبرة وخيط. كل ما عندي شي يحتاج صيانة أجيهم. الأمانة والجودة ثابتة.', service: 'عميل دائم', initials: 'ع' },
  { name: 'لطيفة السبيعي', rating: 5, text: 'كنت أبي أصلح حذاء نسائي غالي وخفت أعطيه لأي محل. حين جربت إبرة وخيط، اطمأنيت تماماً.', service: 'إصلاح حذاء نسائي', initials: 'ل' },
];

function ReviewsSection() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setActive(p => (p + 1) % REVIEWS.length), 4500);
    return () => clearInterval(iv);
  }, []);
  return (
    <section className="py-32 px-6" style={{ background: '#060300' }} dir="rtl">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>آراء عملاؤنا</p>
          <h2 className="text-4xl md:text-5xl font-black" style={{ color: T }}>يقولون عنّا</h2>
          <div className="mt-4 w-24 h-0.5 mx-auto" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REVIEWS.map((r, i) => (
            <FadeIn key={i} delay={i * 0.07}>
              <motion.div className="rounded-2xl p-6 flex flex-col gap-4 h-full cursor-pointer"
                animate={{ background: active === i ? GB + '0.07)' : 'rgba(255,255,255,0.02)', borderColor: active === i ? GB + '0.3)' : 'rgba(255,255,255,0.05)' }}
                style={{ border: '1px solid' }} whileHover={{ y: -4 }} onClick={() => setActive(i)}>
                <div className="flex gap-0.5">
                  {[...Array(r.rating)].map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color: G }} />)}
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: `${GB}0.6)` }}>"{r.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-black shrink-0"
                    style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>{r.initials}</div>
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
          {REVIEWS.map((_, i) => (
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
const BRANDS = ['Hermès','Louis Vuitton','Chanel','Gucci','Prada','Dior','Bottega','Ferragamo','Tod\'s','Louboutin'];
function BrandsSection() {
  return (
    <section className="py-20 px-6 overflow-hidden" style={{ background: '#0A0500', borderTop: `1px solid ${GB}0.08)`, borderBottom: `1px solid ${GB}0.08)` }}>
      <div className="max-w-5xl mx-auto" dir="rtl">
        <FadeIn className="text-center mb-10">
          <p className="text-xs tracking-[0.5em] font-bold mb-2 uppercase" style={{ color: G }}>نتعامل مع</p>
          <h3 className="text-2xl font-black" style={{ color: T }}>أرقى العلامات العالمية</h3>
        </FadeIn>
        <div className="flex gap-0 overflow-hidden">
          {[0, 1].map(k => (
            <motion.div key={k} className="flex gap-8 shrink-0 pr-8"
              animate={{ x: ['0%', '-100%'] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}>
              {BRANDS.map((b, i) => (
                <div key={i} className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap"
                  style={{ background: GB + '0.05)', border: `1px solid ${GB}0.1)`, color: `${GB}0.5)` }}>{b}</div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Track Order ───────────────────────────────────────────────────
function TrackOrderSection() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const STATUS_AR = { pending: 'قيد الانتظار', in_progress: 'جارٍ التنفيذ', ready: 'جاهز للاستلام ✅', completed: 'مكتمل ✅', cancelled: 'ملغى' };

  const search = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('orders').select('order_number,customer_name,status,item_type,created_at').or(`order_number.eq.${code},customer_phone.eq.${code}`).limit(1).single();
      setResult(data ? { found: true, ...data } : { found: false });
    } catch { setResult({ found: false }); }
    finally { setLoading(false); }
  };

  return (
    <section className="py-28 px-6" style={{ background: '#060300' }} dir="rtl">
      <div className="max-w-2xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>تتبع طلبك</p>
          <h2 className="text-4xl font-black mb-3" style={{ color: T }}>أين قطعتك الآن؟</h2>
          <p className="text-sm mb-8" style={{ color: `${GB}0.4)` }}>أدخل رقم الطلب أو رقم جوالك</p>
          <div className="flex gap-3 max-w-md mx-auto mb-6">
            <input value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="ORD-00001 أو 05XXXXXXXX" dir="ltr"
              className="flex-1 px-4 py-3.5 rounded-2xl outline-none text-sm"
              style={{ background: GB + '0.04)', border: `1px solid ${GB}0.15)`, color: T }} />
            <MagneticBtn onClick={search}
              className="px-6 py-3.5 rounded-2xl font-black text-sm text-black"
              style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
              {loading ? '...' : 'بحث'}
            </MagneticBtn>
          </div>
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-5 text-sm"
                style={{ background: result.found ? GB + '0.06)' : 'rgba(255,50,50,0.06)', border: `1px solid ${result.found ? GB + '0.2)' : 'rgba(255,50,50,0.2)'}` }}>
                {result.found
                  ? <div className="text-right space-y-2">
                    <div className="font-black text-base" style={{ color: G }}>{result.order_number}</div>
                    <div style={{ color: T }}>العميل: {result.customer_name}</div>
                    <div className="text-xl font-black" style={{ color: G }}>{STATUS_AR[result.status] || result.status}</div>
                  </div>
                  : <p style={{ color: 'rgba(255,100,100,0.8)' }}>لم يتم العثور على طلب بهذا الرقم</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Branches ──────────────────────────────────────────────────────
function BranchesSection() {
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-public'],
    queryFn: () => base44.Branch.filter({ is_active: true }),
    staleTime: 10 * 60 * 1000,
  });
  const items = branches.length ? branches : [{ name: 'الفرع الرئيسي', city: 'الرياض', address: 'الرياض', phone: '0549678191' }];
  return (
    <section id="branches" className="py-28 px-6" style={{ background: '#0A0500' }} dir="rtl">
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-12">
          <p className="text-xs tracking-[0.5em] font-bold mb-3 uppercase" style={{ color: G }}>فروعنا</p>
          <h2 className="text-4xl font-black" style={{ color: T }}>نحن بالقرب منك</h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((b, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <motion.div className="rounded-2xl p-6" style={{ background: GB + '0.04)', border: `1px solid ${GB}0.1)` }} whileHover={{ borderColor: GB + '0.3)', y: -4 }}>
                <h3 className="font-black text-lg mb-3" style={{ color: T }}>{b.name}</h3>
                <div className="space-y-2 text-sm" style={{ color: `${GB}0.5)` }}>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" style={{ color: G }} />{b.city}{b.address && ` — ${b.address}`}</div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" style={{ color: G }} />السبت — الخميس: 9 صباحاً — 10 مساءً</div>
                  {b.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" style={{ color: G }} /><a href={`tel:${b.phone}`} className="hover:text-yellow-400">{b.phone}</a></div>}
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
  const { data: settingsArr } = useQuery({
    queryKey: ['app-settings-public'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('social_instagram,social_whatsapp,social_twitter,phone').limit(1);
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
    <footer className="py-16 px-6" style={{ background: '#060300', borderTop: `1px solid ${GB}0.08)` }} dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${G}, #e8c96a)` }}>
                <Scissors className="w-4 h-4 text-black" />
              </div>
              <h3 className="text-xl font-black" style={{ color: T }}>إبرة وخيط الإسكافي</h3>
            </div>
            <p className="text-sm leading-relaxed max-w-xs mb-5" style={{ color: `${GB}0.2)` }}>
              حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة من قلب الرياض.
            </p>
            <div className="flex gap-3">
              {[
                { href: instagram, icon: Instagram, color: '#E1306C', label: 'إنستغرام' },
                { href: `https://wa.me/${whatsapp}`, icon: MessageCircle, color: '#25D366', label: 'واتساب' },
                ...(twitter ? [{ href: twitter, icon: Twitter, color: G, label: 'تويتر' }] : []),
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
            <h4 className="text-xs tracking-widest font-bold mb-5 uppercase" style={{ color: G }}>روابط</h4>
            <ul className="space-y-3 text-sm" style={{ color: `${GB}0.3)` }}>
              {[['احجز موعت', '/book'], ['تتبع حجزك', '/my-bookings'], ['المتجر', '/shop'], ['من نحن', '/about'], ['سياسة الإصلاح', '/repair-policy']].map(([label, to]) => (
                <li key={label}><Link to={to} className="hover:text-yellow-400 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs tracking-widest font-bold mb-5 uppercase" style={{ color: G }}>قانوني</h4>
            <ul className="space-y-3 text-sm" style={{ color: `${GB}0.3)` }}>
              {[['سياسة الخصوصية', '/privacy'], ['سياسة التوصيل', '/shipping-policy']].map(([label, to]) => (
                <li key={label}><Link to={to} className="hover:text-yellow-400 transition-colors">{label}</Link></li>
              ))}
              <li><a href={`tel:${phone}`} className="hover:text-yellow-400 transition-colors">{phone}</a></li>
              <li><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition-colors">واتساب</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: GB + '0.08)' }}>
          <p className="text-sm" style={{ color: `${GB}0.12)` }}>© {new Date().getFullYear()} إبرة وخيط الإسكافي. جميع الحقوق محفوظة.</p>
          <div className="flex gap-4 text-xs" style={{ color: `${GB}0.15)` }}>
            <Link to="/privacy" className="hover:text-yellow-400 transition-colors">الخصوصية</Link>
            <Link to="/shipping-policy" className="hover:text-yellow-400 transition-colors">التوصيل</Link>
            <Link to="/about" className="hover:text-yellow-400 transition-colors">من نحن</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function BookingLanding() {
  useTrackVisit('/');
  return (
    <div className="font-tajawal" style={{ scrollBehavior: 'smooth' }}>
      <Helmet>
        <title>إبرة وخيط الإسكافي | إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة في الرياض</title>
        <meta name="description" content="إبرة وخيط الإسكافي — حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة في الرياض. خدمات ترميم وتلميع وتغيير النعال لأرقى الماركات. احجز موعدك الآن!" />
        <meta name="keywords" content="إصلاح أحذية الرياض, تجديد حقائب جلدية, ترميم أحذية فاخرة, إسكافي الرياض, إبرة وخيط, تلميع أحذية, shoe repair riyadh, bag repair riyadh" />
        <link rel="canonical" href="https://cobblerlast.com/" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta property="og:type" content="business.business" />
        <meta property="og:title" content="إبرة وخيط الإسكافي | إصلاح الأحذية والحقائب الفاخرة - الرياض" />
        <meta property="og:description" content="حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة. خدمة استلام وتوصيل في الرياض." />
        <meta property="og:url" content="https://cobblerlast.com/" />
        <meta property="og:image" content="https://cobblerlast.com/og-image.jpg" />
        <meta property="og:locale" content="ar_SA" />
        <meta property="og:site_name" content="إبرة وخيط الإسكافي" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="إبرة وخيط الإسكافي | إصلاح الأحذية والحقائب الفاخرة" />
        <meta name="twitter:image" content="https://cobblerlast.com/og-image.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "إبرة وخيط الإسكافي",
          "url": "https://cobblerlast.com",
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
