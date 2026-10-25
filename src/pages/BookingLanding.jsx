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
import { RiyalText } from '@/components/shared/SarCurrency';
const ShopMap = React.lazy(() => import('@/components/shared/ShopMap'));

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

function WhatsAppIcon({ className, style }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
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
const HAIR = 'rgba(255,255,255,0.06)';

// (الرأس الشفاف صار جزءاً من الهيرو — انظر HeroSection)

function StoreBtn({ to, primary, children }) {
  return (
    <Link to={to}
      className={`store-btn flex items-center justify-center min-h-[54px] font-semibold text-base ${primary ? 'store-btn-p' : 'store-btn-s'}`}>
      {children}
    </Link>
  );
}

function HeroSection() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const links = [
    [isAr ? 'الخدمات' : 'Services', '#services'],
    [isAr ? 'المتجر' : 'Shop', '/shop'],
    [isAr ? 'المزاد' : 'Auction', '/auction'],
    [isAr ? 'تتبّع الطلب' : 'Track order', '#track'],
  ];
  return (
    <section dir={dir} className="relative w-full overflow-hidden" style={{ minHeight: '100svh', background: '#0b0b0c' }}>
      <img src="/images/hero-workshop.jpg" alt={isAr ? 'حرفي يخيط حذاءً جلدياً في ورشة إبرة وخيط الإسكافي' : 'Craftsman hand-stitching a leather shoe at Needle & Thread Cobbler'}
        className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '62% 50%' }} fetchpriority="high" />
      {/* طبقة داكنة تبدأ بعد منطقة الرأس (الشعار والسلة بدون تعتيم) وتتدرج نزولاً لوضوح النص */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,8,10,0) 0%, rgba(8,8,10,0) 14%, rgba(8,8,10,.5) 40%, rgba(8,8,10,.6) 68%, rgba(8,8,10,.82) 100%)' }} />

      {/* رأس شفاف عائم */}
      <header className="absolute top-0 inset-x-0 z-10 grid items-center px-5 md:px-14 pt-5 md:pt-7" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        <nav className="hidden md:flex items-center gap-8 text-[15px] justify-self-start" style={{ color: '#fff', textShadow: '0 1px 10px rgba(0,0,0,.85)' }}>
          {links.map(([label, to]) => (
            to.startsWith('#')
              ? <a key={to} href={to} className="opacity-90 hover:opacity-100 transition-opacity">{label}</a>
              : <Link key={to} to={to} className="opacity-90 hover:opacity-100 transition-opacity">{label}</Link>
          ))}
        </nav>
        <Link to="/shop" aria-label={isAr ? 'المتجر' : 'Shop'} className="md:hidden w-10 h-10 flex items-center justify-center justify-self-start" style={{ color: '#ece8df' }}>
          <ShoppingBag className="w-5 h-5" />
        </Link>
        <Link to="/" className="flex justify-center" aria-label={t('common.brand')}>
          <img src="/images/cobblers-official-mark-white.png" alt={t('common.brand')} className="h-12 md:h-16 w-auto object-contain" style={{ filter: 'drop-shadow(0 1px 8px rgba(0,0,0,.8))' }} />
        </Link>
        <div className="flex justify-end items-center gap-3 justify-self-end"><LanguageSwitcher /></div>
      </header>

      {/* نص الهيرو بالمنتصف */}
      <div className="relative z-[1] flex flex-col items-center justify-center text-center px-6" style={{ minHeight: '100svh', paddingTop: 70 }}>
        <p className="text-xs tracking-[0.3em]" style={{ color: '#fff', textShadow: '0 1px 12px rgba(0,0,0,.9)' }}>{t('home.hero.eyebrow')}</p>
        <h1 className="mt-5 font-bold leading-[1.25] max-w-3xl" style={{ fontSize: 'clamp(2.3rem, 6.5vw, 4.4rem)', color: '#fff', textShadow: '0 2px 24px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.6)', textAlign: 'center' }}>
          {t('home.hero.titleStart')} {t('home.hero.titleEnd')}
        </h1>
        <h2 className="mt-5 text-base md:text-lg font-light max-w-xl leading-8" style={{ color: '#fff', textAlign: 'center', textShadow: '0 1px 14px rgba(0,0,0,.9)' }}>{t('home.hero.seoSubtitle')}</h2>
        <div className="mt-9 flex flex-col sm:flex-row gap-3 w-full" style={{ maxWidth: 460 }}>
          <div className="flex-1"><StoreBtn to="/book" primary>{t('home.hero.ctaPrimary')}</StoreBtn></div>
          <div className="flex-1 hero-ghost"><StoreBtn to="/my-bookings">{t('common.nav.trackBooking')}</StoreBtn></div>
        </div>
      </div>
    </section>
  );
}

// قائمة الروابط: صفوف بعرض الشاشة مثل قوائم المتاجر
function MenuRows() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const rows = [
    [isAr ? 'دكّة الإسكافي — المتجر' : "Cobbler's Bench — Shop", '/shop'],
    [isAr ? 'سوق المزاد' : 'Auction', '/auction'],
    [isAr ? 'تتبّع طلبك' : 'Track order', '#track'],
    [t('common.nav.story'), '#about'],
    [t('common.nav.customers'), '#reviews'],
  ];
  return (
    <nav className="mx-auto" style={{ maxWidth: 760 }} dir={dir} aria-label={isAr ? 'القائمة' : 'Menu'}>
      {rows.map(([label, href], i) => {
        const inner = (<><span>{label}</span><Arrow className="w-4 h-4 store-arrow" /></>);
        const cls = 'store-row flex items-center justify-between px-6 py-5 text-[17px]';
        const st = { borderBottom: `1px solid ${HAIR}`, borderTop: i === 0 ? `1px solid ${HAIR}` : undefined };
        return href.startsWith('/')
          ? <Link key={href} to={href} className={cls} style={st}>{inner}</Link>
          : <a key={href} href={href} className={cls} style={st}>{inner}</a>;
      })}
    </nav>
  );
}

// ── Services ─────────────────────────────────────────────────────
const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function ServicesSection() {
  const { t, dir, lang } = useLanguage();
  const services = t('home.services.items');
  const steps = t('home.services.steps');
  const num = (i) => (lang === 'ar' ? toAr(String(i + 1).padStart(2, '0')) : String(i + 1).padStart(2, '0'));
  return (
    <section id="services" className="px-6 pt-16 pb-4" dir={dir} style={{ background: '#0b0b0c' }}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <p className="text-xs tracking-[0.25em]" style={{ color: '#8d8a82' }}>{t('home.services.eyebrow')}</p>
        <h2 className="mt-2.5 text-[28px] font-semibold leading-snug" style={{ color: '#ece8df' }}>{t('home.services.title')}</h2>
        <p className="mt-3 text-sm leading-loose font-light" style={{ color: '#a8a398' }}>{t('home.services.desc')}</p>
        <div className="mt-7" style={{ borderTop: `1px solid ${HAIR}` }}>
          {services.map((s, i) => (
            <Link key={i} to="/book" className="store-row flex items-start gap-5 py-6" style={{ borderBottom: `1px solid ${HAIR}` }}>
              <span className="text-[13px] pt-1 min-w-[26px]" style={{ color: '#8d8a82' }}>{num(i)}</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold" style={{ color: '#ece8df' }}>{s.title}</h3>
                <p className="mt-1.5 text-sm leading-loose font-light" style={{ color: '#a8a398' }}>{s.desc}</p>
              </div>
              <span className="text-sm pt-1 whitespace-nowrap" style={{ color: '#ece8df' }}><RiyalText text={s.price} /></span>
            </Link>
          ))}
        </div>

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
function AboutSection() {
  const { t, dir } = useLanguage();
  return (
    <section id="about" className="px-6 py-16" dir={dir}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <p className="text-xs tracking-[0.25em]" style={{ color: '#8d8a82' }}>{t('home.about.eyebrow')}</p>
        <h2 className="mt-2.5 text-[28px] font-semibold leading-snug" style={{ color: '#ece8df' }}>{t('home.about.titleLine1')} {t('home.about.titleLine2')}</h2>
        <p className="mt-4 text-[15px] leading-loose font-light" style={{ color: '#a8a398' }}>{t('home.about.desc')}</p>
        <Link to="/about" className="store-btn store-btn-s mt-7 inline-flex items-center justify-center min-h-[48px] px-8 font-semibold text-sm">{t('home.about.cta')}</Link>
      </div>
    </section>
  );
}

// ── Reviews ───────────────────────────────────────────────────────
function ReviewsSection() {
  const { t, dir } = useLanguage();
  const reviews = t('home.reviews.items');
  const loop = [...reviews, ...reviews];
  return (
    <section id="reviews" className="py-16 overflow-hidden" dir={dir}>
      <div className="px-6 mx-auto mb-8" style={{ maxWidth: 760 }}>
        <p className="text-xs tracking-[0.25em]" style={{ color: '#8d8a82' }}>{t('home.reviews.eyebrow')}</p>
        <h2 className="mt-2.5 text-[28px] font-semibold" style={{ color: '#ece8df' }}>{t('home.reviews.title')}</h2>
      </div>
      <div dir="ltr" className="review-marquee" aria-label={t('home.reviews.title')}>
        <div className="review-track">
          {loop.map((r, i) => (
            <figure key={i} dir={dir} className="review-card" aria-hidden={i >= reviews.length ? 'true' : undefined}>
              <div className="flex gap-0.5 mb-4">{[...Array(5)].map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color: '#ece8df' }} />)}</div>
              <blockquote className="text-[15px] leading-loose font-light flex-1" style={{ color: '#cfcac0' }}>{r.text}</blockquote>
              <figcaption className="mt-5 pt-4 flex items-center justify-between text-sm" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <span className="font-semibold" style={{ color: '#ece8df' }}>{r.name}</span>
                <span className="text-xs" style={{ color: '#8d8a82' }}>{r.service}</span>
              </figcaption>
            </figure>
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
          {items.slice(0, 5).map((f, i) => (
            <details key={i} className="group px-5 py-5 cursor-pointer"
              style={{ background: 'transparent', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <summary className="font-bold text-base list-none flex items-center justify-between gap-4" style={{ color: T }}>
                <h3 className="font-bold text-base">{f.q}</h3>
                <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45" style={{ color: GT }}>+</span>
              </summary>
              <p className="mt-3 text-sm leading-7" style={{ color: '#bdb8ad' }}><RiyalText text={f.a} /></p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const SHOP = { lat: 24.598775, lng: 46.759599 };
const SHOP_ADDRESS_AR = 'الرياض، حي العزيزية، شارع الشباب';
const SHOP_ADDRESS_EN = 'Al Aziziyah District, Al Shabab Street, Riyadh';

function BranchesSection() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const { data: siteData } = useSiteData();
  const b = (siteData?.branches || [])[0] || {};
  const phone = b.phone || siteData?.settings?.phone || '0549678191';
  const mapsUrl = b.maps_url || `https://www.google.com/maps/search/?api=1&query=${SHOP.lat},${SHOP.lng}`;
  const address = isAr ? SHOP_ADDRESS_AR : SHOP_ADDRESS_EN;
  return (
    <section id="branches" className="px-6 py-16" dir={dir}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <p className="text-xs tracking-[0.25em]" style={{ color: '#8d8a82' }}>{isAr ? 'موقعنا' : 'Visit us'}</p>
        <h2 className="mt-2.5 text-[28px] font-semibold" style={{ color: '#ece8df' }}>{isAr ? 'زرنا في الرياض' : 'Find us in Riyadh'}</h2>
        <div className="mt-7 overflow-hidden" style={{ border: '1px solid rgba(255,255,255,.08)' }}>
          <div className="relative" style={{ height: 300, background: '#131315' }}>
            <React.Suspense fallback={null}>
              <ShopMap lat={SHOP.lat} lng={SHOP.lng} height={300} />
            </React.Suspense>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={isAr ? 'فتح الموقع في الخرائط' : 'Open in Maps'} className="absolute inset-0 z-[500]" />
          </div>
          <div className="p-6 flex flex-col gap-5" style={{ background: '#0f0f10' }}>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#ece8df' }} />
              <div>
                <p className="font-semibold" style={{ color: '#ece8df' }}>{address}</p>
                <p className="mt-1 text-sm" style={{ color: '#a8a398' }}>{t('home.branches.hours')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="store-btn store-btn-p flex items-center justify-center gap-2 min-h-[50px] font-semibold text-sm">
                <MapPin className="w-4 h-4" />{isAr ? 'الاتجاهات' : 'Directions'}
              </a>
              <a href={`tel:${phone}`} className="store-btn store-btn-s flex items-center justify-center gap-2 min-h-[50px] font-semibold text-sm">
                <Phone className="w-4 h-4" />{isAr ? 'اتصال' : 'Call'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────
// شعارات الدفع بلون موحّد (لون الفوتر) — كلمات/رموز بسيطة بدون ألوان العلامات
function PaymentMarks() {
  const c = '#bdb8ad';
  const box = { height: 30, width: 'auto', display: 'block' };
  return (
    <div className="flex items-center flex-wrap gap-x-7 gap-y-4" dir="ltr" aria-label="Payment methods">
      <svg viewBox="0 0 64 28" style={box} fill={c} role="img" aria-label="Apple Pay">
        <g transform="translate(2,3) scale(.8)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></g>
        <text x="22" y="20" fontSize="15" fontWeight="600" fontFamily="Inter, Helvetica, Arial, sans-serif">Pay</text>
      </svg>
      <svg viewBox="0 0 56 28" style={box} fill={c} role="img" aria-label="Visa">
        <text x="2" y="22" fontSize="23" fontWeight="900" fontStyle="italic" letterSpacing="-1" fontFamily="Inter, Helvetica, Arial, sans-serif">VISA</text>
      </svg>
      <svg viewBox="0 0 44 28" style={box} role="img" aria-label="Mastercard">
        <circle cx="16" cy="14" r="11" fill={c} />
        <circle cx="28" cy="14" r="11" fill={c} opacity=".55" />
      </svg>
      <svg viewBox="0 0 64 28" style={box} fill={c} role="img" aria-label="mada">
        <rect x="2" y="6" width="16" height="4" /><rect x="2" y="13" width="16" height="4" />
        <text x="22" y="14" fontSize="12" fontWeight="700" fontFamily="Inter, Helvetica, Arial, sans-serif">mada</text>
        <text x="22" y="25" fontSize="10" fontWeight="700" fontFamily="'IBM Plex Sans Arabic', Arial, sans-serif">مدى</text>
      </svg>
    </div>
  );
}

// شارة تسجيل ضريبة القيمة المضافة (رمز محايد — يُستبدل بالشعار الرسمي لو توفّر ملفه)
function VatEmblem({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="#ece8df" strokeWidth="2" role="img" aria-label="VAT">
      <rect x="4" y="4" width="56" height="56" />
      <rect x="10" y="10" width="44" height="44" strokeOpacity=".45" />
      <text x="32" y="30" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ece8df" stroke="none" fontFamily="Inter, Arial, sans-serif">VAT</text>
      <text x="32" y="46" textAnchor="middle" fontSize="9" fill="#ece8df" stroke="none" fontFamily="'IBM Plex Sans Arabic', Arial, sans-serif">15%</text>
    </svg>
  );
}

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
    { href: `https://wa.me/${whatsapp}`, icon: WhatsAppIcon, label: 'WhatsApp' },
    ...(twitter ? [{ href: twitter, icon: Twitter, label: 'Twitter' }] : []),
  ];
  const isAr = dir === 'rtl';
  const vat = '314151483700003';
  const groups = [
    { title: isAr ? 'الشركة' : 'Company', links: [[t('common.footer.about'), '/about'], [t('common.footer.careers'), '/careers'], [isAr ? 'فرعنا' : 'Our branch', '#branches']] },
    { title: isAr ? 'خدمة العملاء' : 'Customer service', links: [[t('common.footer.book'), '/book'], [t('common.footer.trackBooking'), '/my-bookings'], [t('common.footer.shop'), '/shop'], [isAr ? 'اتصل بنا' : 'Call us', `tel:${phone}`], [isAr ? 'واتساب' : 'WhatsApp', `https://wa.me/${whatsapp}`]] },
    { title: isAr ? 'السياسات' : 'Policies', links: [[t('common.footer.repairPolicy'), '/repair-policy'], [t('common.footer.shipping'), '/shipping-policy'], [t('common.footer.privacy'), '/privacy']] },
  ];
  const LinkItem = ({ to, children }) => (/^(tel:|https?:|#)/.test(to)
    ? <a href={to} className="hover:text-white transition-colors" {...(to.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>
    : <Link to={to} className="hover:text-white transition-colors">{children}</Link>);
  const line = '1px solid rgba(255,255,255,.14)';
  return (
    <footer className="px-6 pt-14 pb-0" style={{ background: '#2a2b30', color: '#d9d6cf' }} dir={dir}>
      <div className="max-w-5xl mx-auto">
        {/* صف تواصل بخط سفلي مثل نموذج الاشتراك */}
        <h3 className="text-xl md:text-2xl font-normal" style={{ color: '#ece8df' }}>{isAr ? 'تواصل معنا للحصول على أفضل خدمة' : 'Get in touch for the best service'}</h3>
        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer"
          className="mt-6 flex items-center justify-between pb-4 text-sm" style={{ borderBottom: '2px solid #ece8df', color: '#bdb8ad' }}>
          <span>{isAr ? 'راسلنا على واتساب' : 'Message us on WhatsApp'}</span>
          {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        </a>

        <div className="flex justify-center mt-14 mb-10">
          <img src="/images/cobblers-official-mark-white.png" alt={t('common.brand')} className="h-20 w-auto object-contain opacity-90" loading="lazy" />
        </div>

        {/* جوال: أكورديون */}
        <div className="md:hidden">
          {groups.map((g) => (
            <details key={g.title} className="group" style={{ borderTop: line }}>
              <summary className="flex items-center justify-between py-6 text-lg cursor-pointer list-none" style={{ color: '#ece8df' }}>
                {g.title}
                <span className="text-2xl leading-none group-open:hidden" aria-hidden>+</span>
                <span className="text-2xl leading-none hidden group-open:inline" aria-hidden>−</span>
              </summary>
              <ul className="pb-6 space-y-4 text-sm" style={{ color: '#bdb8ad' }}>
                {g.links.map(([label, to]) => <li key={label}><LinkItem to={to}>{label}</LinkItem></li>)}
              </ul>
            </details>
          ))}
          <div style={{ borderTop: line }} />
        </div>

        {/* ديسكتوب: ثلاثة أعمدة */}
        <div className="hidden md:grid grid-cols-3 gap-10 pt-10" style={{ borderTop: line }}>
          {groups.map((g) => (
            <div key={g.title}>
              <h4 className="text-base mb-5" style={{ color: '#ece8df' }}>{g.title}</h4>
              <ul className="space-y-3.5 text-sm" style={{ color: '#bdb8ad' }}>
                {g.links.map(([label, to]) => <li key={label}><LinkItem to={to}>{label}</LinkItem></li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 text-sm leading-8" style={{ color: '#bdb8ad' }}>
          <p>{isAr ? 'الرياض، حي العزيزية، شارع الشباب' : 'Al Aziziyah, Al Shabab St, Riyadh'}</p>
          <p dir="ltr" style={{ textAlign: isAr ? 'right' : 'left' }}>{phone}</p>
        </div>

        <div className="mt-10"><PaymentMarks /></div>

        <div className="mt-10 flex items-center justify-between gap-4 pb-6" style={{ borderBottom: line }}>
          <p className="text-sm" style={{ color: '#bdb8ad' }}>© {new Date().getFullYear()} {t('common.brand')} · {t('common.footer.rights')}</p>
          <div className="flex gap-4">
            {socials.map((x, i) => (
              <a key={i} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={x.label} className="opacity-80 hover:opacity-100 transition-opacity" style={{ color: '#ece8df' }}>
                <x.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
      {/* شريط الشعارات الرسمية: السجل التجاري + ضريبة القيمة المضافة */}
      <div className="-mx-6 px-6 py-5 flex items-center justify-center gap-8" style={{ background: '#1f2024', color: '#bdb8ad' }}>
        <div className="flex items-center gap-3">
          <img src="/images/cr-emblem-white.png" alt={isAr ? 'السجل التجاري' : 'Commercial Registration'} className="w-12 h-12 object-contain" loading="lazy" />
          <div className="text-[11px] leading-5"><p>{isAr ? 'السجل التجاري' : 'CR No.'}</p><p dir="ltr" className="font-semibold text-xs" style={{ color: '#ece8df' }}>{crNumber || '7051288830'}</p></div>
        </div>
        <div className="flex items-center gap-3">
          <VatEmblem className="w-12 h-12" />
          <div className="text-[11px] leading-5"><p>{isAr ? 'الرقم الضريبي' : 'VAT No.'}</p><p dir="ltr" className="font-semibold text-xs" style={{ color: '#ece8df' }}>{vat}</p></div>
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
    <div className="font-tajawal store" style={{ scrollBehavior: 'smooth' }}>
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
        <meta property="og:image" content="https://www.needlecobbler.com/og-image-v2.jpg" />
        <meta property="og:locale" content={isAr ? 'ar_SA' : 'en_US'} />
        <meta property="og:site_name" content={isAr ? 'إبرة وخيط الإسكافي' : 'Ebra & Khait Cobbler'} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={isAr ? 'إبرة وخيط الإسكافي | إصلاح الأحذية والحقائب الفاخرة' : 'Ebra & Khait Cobbler | Luxury Shoe & Bag Repair'} />
        <meta name="twitter:image" content="https://www.needlecobbler.com/og-image-v2.jpg" />
        {/* البيانات المنظمة (LocalBusiness/FAQPage/WebSite) تُحقن بالـHTML الثابت عند البناء — scripts/seo-build.mjs */}
      </Helmet>
      <HeroSection />
      <MenuRows />
      <ServicesSection />
      <BeforeAfterSection />
      <ReviewsSection />
      <AboutSection />
      <BrandsSection />
      <BranchesSection />
      <FaqSection />
      <TrackOrderSection />
      <section className="px-6 pb-4" dir={isAr ? 'rtl' : 'ltr'}>
        <details className="mx-auto" style={{ maxWidth: 760, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <summary className="cursor-pointer list-none py-5 text-sm flex items-center justify-between" style={{ color: '#a8a398' }}>
            <span>{isAr ? 'كل خدماتنا وأحياء التغطية' : 'All services & coverage areas'}</span><span aria-hidden="true">+</span>
          </summary>
          <ServiceLinksSection />
          <AreasSection />
        </details>
      </section>
      <Footer />
    </div>
  );
}
