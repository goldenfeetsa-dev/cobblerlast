import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { motion, useInView } from 'framer-motion';
import { base44 } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { MapPin, Phone, Clock,
  Instagram, MessageCircle, Star, Award, Shield,
  Scissors, Sparkles, Package, ExternalLink, ChevronDown, Gem, ShoppingBag, FileText, Twitter } from
'lucide-react';

// Palette: Dark Brown #1A0F00 | Gold #C9A84C | Warm Dark #2C1A00 | Text #F5EDD8

function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} className={className}
    initial={{ opacity: 0, y: 32 }}
    animate={inView ? { opacity: 1, y: 0 } : {}}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>);

}

// ── Navbar ─────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 transition-all duration-500"
    style={{
      background: scrolled ? 'rgba(18,10,0,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(201,168,76,0.12)' : 'none'
    }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between" dir="rtl">
        {/* Logo */}
        <Link to="/booking">
          <span className="text-xl font-black" style={{ color: '#C9A84C' }}>
            إبرة وخيط الإسكافي
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-7 text-sm font-medium" style={{ color: 'rgba(245,237,216,0.7)' }}>
          <a href="#hero" className="hover:text-yellow-400 transition-colors border-b-2 pb-0.5" style={{ borderColor: '#C9A84C', color: '#F5EDD8' }}>الرئيسية</a>
          <a href="#services" className="hover:text-yellow-400 transition-colors">خدماتنا</a>
          <a href="#request" className="hover:text-yellow-400 transition-colors">طلب خدمة</a>
          <Link to="/shop" className="hover:text-yellow-400 transition-colors flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />المتجر
          </Link>
          <Link to="/repair-policy" className="hover:text-yellow-400 transition-colors flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />سياسة الإصلاح
          </Link>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link to="/my-bookings" className="hidden lg:block text-sm font-medium hover:text-yellow-400 transition-colors" style={{ color: 'rgba(245,237,216,0.6)' }}>
            تتبع حجزك
          </Link>
          <a href="https://wa.me/966549678191" target="_blank" rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold text-white transition-all hover:scale-105"
          style={{ background: '#25D366' }}>
            <MessageCircle className="w-3.5 h-3.5" />واتساب
          </a>
          <Link to="/book">
            <button className="px-5 h-9 rounded-full text-sm font-bold text-black transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
              احجز موعد
            </button>
          </Link>
          {/* Mobile menu */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ color: '#F5EDD8' }}>
            <div className="w-5 h-0.5 mb-1 transition-all" style={{ background: '#C9A84C', transform: menuOpen ? 'rotate(45deg) translate(3px, 3px)' : '' }} />
            <div className="w-5 h-0.5 mb-1" style={{ background: menuOpen ? 'transparent' : '#C9A84C' }} />
            <div className="w-5 h-0.5 transition-all" style={{ background: '#C9A84C', transform: menuOpen ? 'rotate(-45deg) translate(3px, -3px)' : '' }} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen &&
      <div className="md:hidden px-6 pb-6 pt-2 space-y-2 text-sm font-medium" style={{ background: 'rgba(18,10,0,0.98)' }} dir="rtl">
          {[
        { label: 'الرئيسية', href: '#hero', external: false },
        { label: 'خدماتنا', href: '#services', external: false }].
        map((item) =>
        <a key={item.label} href={item.href} className="block py-2.5 border-b hover:text-yellow-400 transition-colors"
        style={{ color: 'rgba(245,237,216,0.7)', borderColor: 'rgba(201,168,76,0.1)' }}
        onClick={() => setMenuOpen(false)}>{item.label}</a>
        )}
          <Link to="/shop" className="flex items-center gap-2 py-2.5 border-b hover:text-yellow-400 transition-colors"
        style={{ color: 'rgba(245,237,216,0.7)', borderColor: 'rgba(201,168,76,0.1)' }} onClick={() => setMenuOpen(false)}>
            <ShoppingBag className="w-4 h-4" />المتجر
          </Link>
          <Link to="/repair-policy" className="flex items-center gap-2 py-2.5 border-b hover:text-yellow-400 transition-colors"
        style={{ color: 'rgba(245,237,216,0.7)', borderColor: 'rgba(201,168,76,0.1)' }} onClick={() => setMenuOpen(false)}>
            <FileText className="w-4 h-4" />سياسة الإصلاح
          </Link>
          <Link to="/my-bookings" className="block py-2.5 border-b hover:text-yellow-400 transition-colors"
        style={{ color: '#C9A84C', borderColor: 'rgba(201,168,76,0.1)' }} onClick={() => setMenuOpen(false)}>
            تتبع حجزك
          </Link>
          <a href="https://wa.me/966549678191" target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 py-2.5 font-bold hover:text-green-400 transition-colors"
        style={{ color: '#25D366' }} onClick={() => setMenuOpen(false)}>
            <MessageCircle className="w-4 h-4" />تواصل عبر واتساب
          </a>
        </div>
      }
    </nav>);

}

// ── Hero ──────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden"
    style={{ background: 'linear-gradient(135deg, #120800 0%, #1E1000 40%, #2A1500 70%, #1A0C00 100%)' }}>

      {/* Subtle texture */}
      <div className="absolute inset-0 opacity-[0.03]"
      style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C9A84C 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Warm glow right */}
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none"
      style={{ background: 'radial-gradient(circle at 80% 50%, rgba(180,100,20,0.18) 0%, transparent 65%)' }} />

      {/* Gold glow left */}
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] pointer-events-none"
      style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full" dir="rtl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-screen pt-16">

          {/* Text - Right */}
          <div className="order-1 lg:order-1">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
              <Scissors className="w-3 h-3" />
              فن ترميم الجلدية الفاخرة
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-4"
            style={{ color: '#F5EDD8' }}>
              حيث يلتقي التراث
            </motion.h1>
            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }}
            className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-8"
            style={{ color: '#C9A84C' }}>
              بالدقة الرقمية
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.35 }}
            className="text-base md:text-lg leading-relaxed mb-10 max-w-lg"
            style={{ color: 'rgba(245,237,216,0.55)' }}>
              نحن لا نقوم فقط بإصلاح الأحذية، بل نحيي القصص الكاملة خلف كل خيط وكل قطعة جلد. في مشغلنا الرقمي، نحول الأحذية المستعملة إلى تحف فنية متجددة.
            </motion.p>

            {/* Feature badges */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.45 }}
            className="flex flex-wrap gap-3 mb-10">
              {['خياطة يدوية دقيقة', 'تلميع احترافي', 'ترميم جلد فاخر'].map((tag, i) =>
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: 'rgba(245,237,216,0.7)' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#C9A84C' }} />
                  {tag}
                </span>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55 }}
            className="flex flex-wrap gap-4">
              <Link to="/book">
                <button className="px-8 h-13 py-3.5 rounded-full font-black text-base text-black transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)', boxShadow: '0 10px 40px rgba(201,168,76,0.4)' }}>
                  ابدأ رحلة الترميم
                </button>
              </Link>
              <Link to="/my-bookings">
                <button className="px-8 py-3.5 rounded-full font-bold text-base transition-all hover:scale-105 flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245,237,216,0.2)', color: '#F5EDD8' }}>
                  تتبع حجزك
                </button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.7 }}
            className="flex gap-10 mt-14 pt-8 border-t" style={{ borderColor: 'rgba(201,168,76,0.12)' }}>
              {[{ num: '+20', label: 'سنة خبرة' }, { num: '+5000', label: 'عميل راضٍ' }, { num: '100%', label: 'جودة مضمونة' }].map((s) =>
              <div key={s.label}>
                  <div className="text-2xl font-black" style={{ color: '#C9A84C' }}>{s.num}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(245,237,216,0.35)' }}>{s.label}</div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Shoe Image - Left */}
          <motion.div initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.1, delay: 0.3 }}
          className="order-2 lg:order-2 flex items-center justify-center relative">
            {/* Card background */}
            <div className="relative w-full max-w-[520px]">
              <div className="absolute inset-0 rounded-3xl"
              style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(60,30,0,0.6) 100%)', border: '1px solid rgba(201,168,76,0.15)' }} />

              {/* Floating badge top right */}
              <div className="absolute top-5 left-5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(18,10,0,0.8)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', backdropFilter: 'blur(8px)' }}>
                <Scissors className="w-3 h-3" />
                خياطة يدوية دقيقة
              </div>

              {/* Floating badge bottom left */}
              <div className="absolute bottom-8 right-5 z-10 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(18,10,0,0.85)', border: '1px solid rgba(201,168,76,0.2)', backdropFilter: 'blur(8px)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.15)' }}>
                  <Award className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
                </div>
                <div>
                  <div className="font-bold text-xs" style={{ color: '#F5EDD8' }}>تجربة إيطالية فاخرة</div>
                  <div className="text-xs" style={{ color: 'rgba(245,237,216,0.4)' }}>جودة عالمية</div>
                </div>
              </div>

              <img
                src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80"
                alt="حذاء جلدي فاخر"
                className="w-full rounded-3xl object-cover"
                style={{ height: '460px', transform: 'rotate(-3deg)', filter: 'brightness(0.9) saturate(1.1)' }} />
              

              {/* Glow under */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-16 blur-2xl rounded-full pointer-events-none"
              style={{ background: 'rgba(201,168,76,0.2)' }} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      style={{ color: 'rgba(245,237,216,0.2)' }}>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </div>
    </section>);

}

// ── Services Section ──────────────────────────────────────────
const SERVICES = [
{
  icon: Scissors,
  title: 'ترميم الأحذية',
  desc: 'خياطة مخفية دقيقة وتغيير نعال بأيدي حرفيين متخصصين لتبدو كالجديد.',
  tag: 'أحذية راقية',
  img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80'
},
{
  icon: Package,
  title: 'تجديد الحقائب',
  desc: 'نُعيد لحقيبتك بريقها الأصلي — ترميم الجلد وإعادة التلوين بأعلى معايير الجودة.',
  tag: 'حقائب فاخرة',
  img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'
},
{
  icon: Sparkles,
  title: 'تلميع وتلوين',
  desc: 'تقنيات أوروبية فاخرة تُعيد البريق وتُعمّق اللون — استثنائية ودائمة.',
  tag: 'عناية استثنائية',
  img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80'
}];


function ServicesSection() {
  return (
    <section id="services" className="py-28 px-6" style={{ background: '#120A00' }}>
      <div className="max-w-6xl mx-auto" dir="rtl">
        <FadeIn className="text-center mb-16">
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: '#C9A84C' }}>خدمات المشغل</p>
          <h2 className="text-4xl md:text-5xl font-black" style={{ color: '#F5EDD8' }}>مجموعة متكاملة من الخدمات</h2>
          <p className="mt-3 max-w-xl mx-auto text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,0.4)' }}>
            نقدم مجموعة متكاملة من الخدمات المتخصصة التي تعيد بريقها الأول لأحذيتك باستخدام أجود الخامات العالمية
          </p>
          <div className="mt-6 w-24 h-0.5 mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SERVICES.map((s, i) =>
          <FadeIn key={i} delay={i * 0.12}>
              <div className="group rounded-2xl overflow-hidden cursor-pointer h-full flex flex-col transition-all duration-300 hover:-translate-y-1"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
                <div className="relative overflow-hidden" style={{ height: '220px' }}>
                  <img src={s.img} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 opacity-100" style={{ background: 'linear-gradient(to bottom, transparent 40%, #120A00 100%)' }} />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <span className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full text-xs font-bold w-fit"
                style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                    <s.icon className="w-3 h-3" />
                    {s.tag}
                  </span>
                  <h3 className="text-xl font-black mb-2" style={{ color: '#F5EDD8' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: 'rgba(245,237,216,0.45)' }}>{s.desc}</p>
                  <Link to="/book">
                    <div className="flex items-center gap-2 font-bold text-sm transition-all hover:gap-3" style={{ color: '#C9A84C' }}>
                      <span>احجز الآن</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                </div>
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    </section>);

}

// ── About / Works Section ──────────────────────────────────────
function AboutSection() {
  const stats = [
  { icon: Award, num: '+20', label: 'سنة خبرة' },
  { icon: Star, num: '+5000', label: 'عميل راضٍ' },
  { icon: Shield, num: '100%', label: 'ضمان الجودة' },
  { icon: Gem, num: 'يد', label: 'حرفيون متخصصون' }];

  return (
    <section id="about" className="py-28 px-6" style={{ background: '#0E0700' }} dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeIn className="grid grid-cols-2 gap-3">
            {[
            'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
            'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80',
            'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
            'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80'].
            map((src, i) =>
            <div key={i} className={`rounded-xl overflow-hidden ${i % 2 === 1 ? 'mt-6' : ''}`}
            style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
                <img src={src} alt="" className="w-full h-44 object-cover hover:scale-105 transition-transform duration-700" />
              </div>
            )}
          </FadeIn>

          <FadeIn delay={0.15}>
            <p className="text-xs tracking-[0.4em] font-bold mb-4 uppercase" style={{ color: '#C9A84C' }}>قصتنا</p>
            <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight" style={{ color: '#F5EDD8' }}>
              من حبنا للجلد<br /><span style={{ color: '#C9A84C' }}>وُلدت الحرفة</span>
            </h2>
            <p className="leading-relaxed text-base mb-8" style={{ color: 'rgba(245,237,216,0.45)' }}>
              إبرة وخيط الإسكافي براند سعودي أصيل من قلب الرياض. نجمع بين عراقة الحرفة اليدوية وأحدث التقنيات للمحافظة على مقتنياتكم الثمينة. خبرة تمتد لأكثر من عقدين، وآلاف العملاء الذين وثقوا بأيدينا.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {stats.map((s, i) =>
              <div key={i} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.12)' }}>
                  <s.icon className="w-5 h-5 shrink-0" style={{ color: '#C9A84C' }} />
                  <div>
                    <div className="text-xl font-black" style={{ color: '#F5EDD8' }}>{s.num}</div>
                    <div className="text-xs" style={{ color: 'rgba(245,237,216,0.35)' }}>{s.label}</div>
                  </div>
                </div>
              )}
            </div>
            <Link to="/book">
              <button className="px-8 py-3.5 rounded-full font-bold text-base text-black hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)', boxShadow: '0 8px 30px rgba(201,168,76,0.3)' }}>
                احجز الآن — حنا بالخدمة ✨
              </button>
            </Link>
          </FadeIn>
        </div>
      </div>
    </section>);

}

// ── Reviews Section ────────────────────────────────────────────
const REVIEWS = [
{ name: 'محمد العنزي', rating: 5, text: 'حضرت بحذاء كعبه انكسر وكنت مأيوس منه، رجع أحسن من الأول! الشغل نظيف جداً والسعر معقول.', service: 'إصلاح كعب', initials: 'م' },
{ name: 'سارة الشمري', rating: 5, text: 'حقيبتي الـ LV كانت تحتاج ترميم في المقبض، خلوها تطلع وكأنها جديدة. الدقة في التفاصيل لا توصف!', service: 'ترميم حقيبة فاخرة', initials: 'س' },
{ name: 'فهد الدوسري', rating: 5, text: 'أحذيتي الجلدية كانت تحتاج تلميع وإعادة تلوين. النتيجة مذهلة، اللون طلع ثابت وعميق.', service: 'تلميع وإعادة تلوين', initials: 'ف' },
{ name: 'نورة القحطاني', rating: 5, text: 'جبت شنطة كانت مقطوعة من الجانب، صلحوها بخيط ذهبي وطلعت أجمل! ما توقعت الشغل يطلع كذا.', service: 'خياطة وترميم', initials: 'ن' },
{ name: 'عبدالله المطيري', rating: 5, text: 'قديم في التعامل مع إبرة وخيط. كل ما عندي شي يحتاج صيانة أجيهم. الأمانة والجودة ثابتة.', service: 'عميل دائم', initials: 'ع' },
{ name: 'لطيفة السبيعي', rating: 5, text: 'كنت أبي أصلح حذاء نسائي غالي وخفت أعطيه لأي محل. حين جربت إبرة وخيط، اطمأنيت تماماً.', service: 'إصلاح حذاء نسائي', initials: 'ل' }];


function ReviewsSection() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setActive((p) => (p + 1) % REVIEWS.length), 4500);
    return () => clearInterval(iv);
  }, []);

  return (
    <section className="py-28 px-6" style={{ background: '#120A00' }} dir="rtl">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: '#C9A84C' }}>آراء عملاؤنا</p>
          <h2 className="text-4xl md:text-5xl font-black" style={{ color: '#F5EDD8' }}>يقولون عنّا</h2>
          <div className="mt-4 w-24 h-0.5 mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {REVIEWS.map((r, i) =>
          <FadeIn key={i} delay={i * 0.07}>
              <div className="rounded-2xl p-6 flex flex-col gap-4 h-full cursor-pointer transition-all duration-500"
            style={{
              background: active === i ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.02)',
              border: active === i ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(255,255,255,0.05)'
            }}
            onClick={() => setActive(i)}>
                <div className="flex gap-0.5">
                  {[...Array(r.rating)].map((_, s) => <Star key={s} className="w-4 h-4 fill-[#C9A84C]" style={{ color: '#C9A84C' }} />)}
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: 'rgba(245,237,216,0.6)' }}>"{r.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-black shrink-0"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>{r.initials}</div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#F5EDD8' }}>{r.name}</p>
                    <p className="text-xs" style={{ color: 'rgba(245,237,216,0.3)' }}>{r.service}</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {REVIEWS.map((_, i) =>
          <button key={i} onClick={() => setActive(i)} className="rounded-full transition-all duration-500"
          style={{ width: active === i ? '22px' : '8px', height: '8px', background: active === i ? '#C9A84C' : 'rgba(201,168,76,0.2)' }} />
          )}
        </div>
      </div>
    </section>);

}

// ── Brands Section ──────────────────────────────────────────────
function BrandsSection() {
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-public'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'sort_order')
  });

  if (brands.length === 0) return null;

  return (
    <section className="py-20 px-6 overflow-hidden" style={{ background: '#0A0600' }}>
      <div className="max-w-6xl mx-auto" dir="rtl">
        <FadeIn className="text-center mb-10">
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: '#C9A84C' }}>نتعامل مع كبرى</p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ color: '#F5EDD8' }}>الماركات العالمية</h2>
          <div className="mt-4 w-24 h-0.5 mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </FadeIn>

        <div className="flex flex-wrap justify-center gap-4">
          {brands.map((brand, i) =>
          <FadeIn key={brand.id} delay={i * 0.05}>
              <div className="flex flex-col items-center gap-2 px-5 py-4 rounded-2xl transition-all hover:-translate-y-1 cursor-default"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)', minWidth: '90px' }}>
                {brand.logo_url ?
              <img src={brand.logo_url} alt={brand.name} className="h-8 object-contain opacity-70 hover:opacity-100 transition-opacity"
              style={{ filter: 'brightness(0) invert(1) sepia(1) saturate(0.2)' }} /> :

              <span className="text-base font-black tracking-wider" style={{ color: 'rgba(201,168,76,0.7)', fontFamily: 'serif' }}>{brand.name}</span>
              }
                <span className="text-[10px]" style={{ color: 'rgba(245,237,216,0.3)' }}>{brand.name_ar}</span>
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    </section>);

}

// ── Branches Section ───────────────────────────────────────────
function BranchesSection() {
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-public'],
    queryFn: () => base44.entities.Branch.filter({ is_active: true }, 'sort_order')
  });

  if (branches.length === 0) return <ContactSection />;

  return (
    <section className="py-28 px-6" style={{ background: '#0E0700' }} dir="rtl">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: '#C9A84C' }}>فروعنا</p>
          <h2 className="text-4xl md:text-5xl font-black" style={{ color: '#F5EDD8' }}>أقرب إليك</h2>
          <div className="mt-4 w-24 h-0.5 mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {branches.map((b, i) =>
          <FadeIn key={b.id} delay={i * 0.1}>
              <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
                {b.maps_embed &&
              <div className="w-full" style={{ height: '200px' }}>
                    <iframe src={b.maps_embed} width="100%" height="200" style={{ border: 0 }}
                allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={b.name} />
                  </div>
              }
                <div className="p-6 space-y-3">
                  <h3 className="text-xl font-black" style={{ color: '#F5EDD8' }}>{b.name}</h3>
                  <div className="flex items-start gap-2 text-sm" style={{ color: 'rgba(245,237,216,0.5)' }}>
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#C9A84C' }} />
                    {b.address}
                  </div>
                  {b.phone &&
                <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(245,237,216,0.5)' }}>
                      <Phone className="w-4 h-4 shrink-0" style={{ color: '#C9A84C' }} />
                      <a href={`tel:${b.phone}`} className="hover:text-yellow-400 transition-colors" dir="ltr">{b.phone}</a>
                    </div>
                }
                  {b.working_hours &&
                <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(245,237,216,0.5)' }}>
                      <Clock className="w-4 h-4 shrink-0" style={{ color: '#C9A84C' }} />
                      {b.working_hours}
                    </div>
                }
                  <div className="flex flex-wrap gap-2 pt-2">
                    {b.whatsapp &&
                  <a href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white hover:scale-105 transition-all"
                  style={{ background: 'linear-gradient(135deg, #25D366, #20bb5a)' }}>
                        <MessageCircle className="w-3.5 h-3.5" />واتساب
                      </a>
                  }
                    {b.maps_url &&
                  <a href={b.maps_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold hover:scale-105 transition-all"
                  style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
                        <ExternalLink className="w-3.5 h-3.5" />خرائط Google
                      </a>
                  }
                  </div>
                </div>
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    </section>);

}

// ── Contact Section ────────────────────────────────────────────
function ContactSection() {
  return (
    <section className="py-28 px-6" style={{ background: '#0E0700' }} dir="rtl">
      <div className="max-w-4xl mx-auto">
        <FadeIn className="text-center mb-14">
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: '#C9A84C' }}>تواصل معنا</p>
          <h2 className="text-4xl md:text-5xl font-black" style={{ color: '#F5EDD8' }}>حنا في الخدمة</h2>
          <div className="mt-4 w-24 h-0.5 mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {[
          {
            icon: Phone, title: 'رقم الجوال',
            content: <><a href="tel:+966549678191" className="block text-sm hover:text-yellow-400 transition-colors" style={{ color: 'rgba(245,237,216,0.5)' }} dir="ltr">+966 54 967 8191</a><a href="tel:0502679930" className="block text-sm mt-1 hover:text-yellow-400 transition-colors" style={{ color: 'rgba(245,237,216,0.5)' }} dir="ltr">0502 679 930</a></>
          },
          {
            icon: Clock, title: 'ساعات العمل',
            content: <><p className="text-sm" style={{ color: 'rgba(245,237,216,0.5)' }}>السبت – الخميس<br /><span style={{ color: '#C9A84C' }}>11:30 ص – 11:30 م</span></p><p className="text-sm mt-2" style={{ color: 'rgba(245,237,216,0.5)' }}>الجمعة<br /><span style={{ color: '#C9A84C' }}>4:00 م – 12:00 م</span></p></>
          },
          {
            icon: MapPin, title: 'الموقع',
            content: <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,0.5)' }}>الرياض، حي العزيزية<br />شارع الشباب<br /><span style={{ color: '#C9A84C' }}>(مقابل دانكن)</span></p>
          }].
          map((card, i) =>
          <FadeIn key={i} delay={i * 0.1}>
              <div className="rounded-2xl p-7 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  <card.icon className="w-6 h-6" style={{ color: '#C9A84C' }} strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-base mb-3" style={{ color: '#F5EDD8' }}>{card.title}</h3>
                {card.content}
              </div>
            </FadeIn>
          )}
        </div>

        <FadeIn delay={0.2}>
          <div className="rounded-2xl overflow-hidden relative" style={{ border: '1px solid rgba(201,168,76,0.15)' }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d935.1209375903!2d46.71860863038!3d24.68225484497!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMjTCsDQwJzU2LjEiTiA0NsKwNDMnMDQuMiJF!5e0!3m2!1sar!2ssa!4v1715000000000!5m2!1sar!2ssa"
              width="100%" height="380" style={{ border: 0 }} allowFullScreen loading="lazy"
              referrerPolicy="no-referrer-when-downgrade" title="إبرة وخيط الإسكافي" />
            <div className="absolute bottom-4 right-4">
              <a href="https://share.google/GaCQdR7DvymCwgBti" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-black hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)', boxShadow: '0 6px 20px rgba(201,168,76,0.4)' }}>
                <MapPin className="w-4 h-4" />افتح على خرائط Google
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.3} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <a href="https://wa.me/966549678191" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 font-bold px-8 h-14 rounded-full text-base transition-all hover:scale-105 text-white"
          style={{ background: 'linear-gradient(135deg, #25D366, #20bb5a)' }}>
            <MessageCircle className="w-5 h-5" />تواصل عبر واتساب
          </a>
          <a href="https://www.instagram.com/ebra.kh8/" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 font-bold px-8 h-14 rounded-full text-base transition-all hover:scale-105 text-white"
          style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
            <Instagram className="w-5 h-5" />تابعنا على انستقرام
          </a>
        </FadeIn>
      </div>
    </section>);

}

// ── Footer ─────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="py-16 px-6" style={{ background: '#080400' }} dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="text-3xl font-black" style={{ color: '#F5EDD8' }}>
              إبرة وخيط<span className="block" style={{ color: '#C9A84C' }}>الإسكافي</span>
            </h3>
            <p className="text-sm mt-3 max-w-xs leading-relaxed" style={{ color: 'rgba(245,237,216,0.2)' }}>
              حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة — من قلب الرياض.
            </p>
            {/* Social icons */}
            <div className="flex gap-3 mt-5">
              <a href="https://www.instagram.com/ebra.kh8/" target="_blank" rel="noopener noreferrer"
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)' }}>
                <Instagram className="w-4 h-4" style={{ color: '#C9A84C' }} />
              </a>
              <a href="https://wa.me/966549678191" target="_blank" rel="noopener noreferrer"
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)' }}>
                <MessageCircle className="w-4 h-4" style={{ color: '#25D366' }} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)' }}>
                <Twitter className="w-4 h-4" style={{ color: '#C9A84C' }} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs tracking-widest font-bold mb-4 uppercase" style={{ color: '#C9A84C' }}>روابط</h4>
            <ul className="space-y-2.5 text-sm" style={{ color: 'rgba(245,237,216,0.3)' }}>
              <li><Link to="/book" className="hover:text-yellow-400 transition-colors">احجز موعدك</Link></li>
              <li><Link to="/my-bookings" className="hover:text-yellow-400 transition-colors">تتبع حجزك</Link></li>
              <li><Link to="/shop" className="hover:text-yellow-400 transition-colors flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" />المتجر</Link></li>
              <li><Link to="/repair-policy" className="hover:text-yellow-400 transition-colors">سياسة الإصلاح</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-xs tracking-widest font-bold mb-4 uppercase" style={{ color: '#C9A84C' }}>خدمات</h4>
            <ul className="space-y-2.5 text-sm" style={{ color: 'rgba(245,237,216,0.3)' }}>
              <li>ترميم الأحذية</li>
              <li>تجديد الحقائب</li>
              <li>تلميع وتلوين</li>
              <li>زيارات منزلية</li>
            </ul>
          </div>
        </div>

        <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ borderColor: 'rgba(201,168,76,0.08)' }}>
          <p className="text-sm" style={{ color: 'rgba(245,237,216,0.12)' }}>© 2025 إبرة وخيط الإسكافي. جميع الحقوق محفوظة.</p>
          <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>صُنع بكل حب في الرياض ❤️</p>
        </div>
      </div>
    </footer>);

}

// ── Request Service Section ────────────────────────────────────
function RequestServiceSection() {
  const services = [
  { title: 'ترميم الأحذية', desc: 'تغيير نعال، خياطة، تلميع، وكل أعمال الإصلاح', from: 80, img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80', tag: 'الأكثر طلباً' },
  { title: 'تجديد الحقائب', desc: 'تنظيف، إصلاح الخياطة، تجديد الألوان والمقابض', from: 150, img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', tag: 'حقائب فاخرة' },
  { title: 'تلميع وتلوين', desc: 'تقنيات أوروبية لإعادة اللون والبريق الأصلي', from: 50, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', tag: 'عناية' }];


  return (
    <section id="request" className="py-28 px-6" style={{ background: '#0A0600' }} dir="rtl">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: '#C9A84C' }}>احجز الآن</p>
          <h2 className="text-4xl md:text-5xl font-black" style={{ color: '#F5EDD8' }}>طلب خدمة</h2>
          <p className="mt-3 max-w-lg mx-auto text-sm" style={{ color: 'rgba(245,237,216,0.4)' }}>اختر الخدمة وسنتواصل معك فوراً لتأكيد التفاصيل</p>
          <div className="mt-6 w-24 h-0.5 mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {services.map((s, i) =>
          <FadeIn key={i} delay={i * 0.1}>
              <div className="rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
                <div className="relative overflow-hidden" style={{ height: '180px' }}>
                  <img src={s.img} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #0A0600 100%)' }} />
                  {s.tag &&
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: 'rgba(201,168,76,0.9)', color: '#1A0C00' }}>{s.tag}</span>
                }
                </div>
                <div className="p-5">
                  <h3 className="font-black text-lg mb-1" style={{ color: '#F5EDD8' }}>{s.title}</h3>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(245,237,216,0.4)' }}>{s.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'rgba(245,237,216,0.35)' }}>
                      يبدأ من <span className="font-black text-base" style={{ color: '#C9A84C' }}>{s.from}</span> ر.س
                    </span>
                    <Link to="/book">
                      <button className="px-4 py-2 rounded-full text-xs font-bold text-black hover:scale-105 transition-all"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>احجز الآن</button>
                    </Link>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}
        </div>

        {/* Quick WhatsApp request */}
        <FadeIn delay={0.3}>
          <div className="rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-6 justify-between"
          style={{ background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)' }}>
            <div>
              <h3 className="font-black text-lg mb-1" style={{ color: '#F5EDD8' }}>تحتاج استشارة أولاً؟</h3>
              <p className="text-sm" style={{ color: 'rgba(245,237,216,0.4)' }}>أرسل صورة قطعتك عبر الواتساب وسنقيّمها مجاناً</p>
            </div>
            <a href="https://wa.me/966549678191?text=السلام عليكم، أريد تقييم قطعتي" target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm text-white hover:scale-105 transition-all"
            style={{ background: 'linear-gradient(135deg, #25D366, #20bb5a)' }}>
              <MessageCircle className="w-4 h-4" />تواصل عبر واتساب
            </a>
          </div>
        </FadeIn>
      </div>
    </section>);

}

// ── Track Order Section ─────────────────────────────────────────
function TrackOrderSection() {
  return (
    <section id="track" className="py-20 px-6" style={{ background: '#0E0700' }} dir="rtl">
      <div className="max-w-2xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: '#C9A84C' }}>متابعة الطلبات</p>
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: '#F5EDD8' }}>تتبع حجزك</h2>
          <p className="text-sm mb-8" style={{ color: 'rgba(245,237,216,0.4)' }}>أدخل رقم هاتفك لعرض حجوزاتك ومتابعة حالتها</p>
          <Link to="/my-bookings">
            <button className="px-10 py-4 rounded-full font-black text-base text-black hover:scale-105 transition-all"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)', boxShadow: '0 8px 30px rgba(201,168,76,0.3)' }}>
              تتبع طلبك الآن
            </button>
          </Link>
        </FadeIn>
      </div>
    </section>);

}

// ── Main ───────────────────────────────────────────────────────
export default function BookingLanding() {
  useTrackVisit('/booking');

  return (
    <div className="font-tajawal" style={{ scrollBehavior: 'smooth' }}>
      <Helmet>
        <title>إبرة وخيط الإسكافي | إصلاح وتجديد الأحذية والحقائب الفاخرة - الرياض</title>
        <meta name="description" content="حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة في الرياض. خدمات ترميم، تلميع، تغيير النعال. احجز موعدك الآن." />
        <meta name="keywords" content="إصلاح أحذية الرياض, تجديد حقائب جلدية, ترميم أحذية فاخرة, إسكافي الرياض, إبرة وخيط, صيانة أحذية, تلميع أحذية" />
        <link rel="canonical" href="https://cobblerlast.com/booking" />
        <meta property="og:title" content="إبرة وخيط الإسكافي | إصلاح الأحذية والحقائب الفاخرة" />
        <meta property="og:description" content="حرفيون سعوديون متخصصون في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة في الرياض." />
        <meta property="og:url" content="https://cobblerlast.com/booking" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "إبرة وخيط الإسكافي - صفحة الحجز",
          "description": "احجز موعد إصلاح أحذيتك أو حقيبتك مع حرفيين سعوديين متخصصين في الرياض",
          "url": "https://cobblerlast.com/booking",
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "الرئيسية", "item": "https://cobblerlast.com" },
              { "@type": "ListItem", "position": 2, "name": "احجز موعد", "item": "https://cobblerlast.com/booking" }
            ]
          }
        })}</script>
      </Helmet>
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <RequestServiceSection />
      <BrandsSection />
      <AboutSection />
      <ReviewsSection />
      <TrackOrderSection />
      <BranchesSection />
      <Footer />
    </div>);

}