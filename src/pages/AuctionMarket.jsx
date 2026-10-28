/**
 * AuctionMarket — سوق المزاد (مزايدة مباشرة على قطع جلدية مجدّدة)
 * كل تعامل الزوار عبر دوال Postgres آمنة (auction_public_list / auction_place_bid / auction_submit_item):
 * لا جدول مكشوف، أسماء المزايدين مقنّعة، والتحقق الكامل على الخادم (حد أدنى، انتهاء الوقت، تمديد ضد القنص).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Gavel, Clock, Flame, ArrowLeftRight, Loader2 } from 'lucide-react';
import { db, storage } from '@/api/supabaseApi';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { SarAmount } from '@/components/shared/SarCurrency';
import { PAGES } from '@/lib/seo/siteData';

const AUCTION_SEO = PAGES.find((p) => p.path === '/auction');
const SITE = 'https://www.needlecobbler.com';
const INK = '#ece8df';
const HAIR = 'rgba(255,255,255,0.1)';
const MUTED = '#8d8a82';
const CATS = { all: ['الكل', 'All'], bags: ['حقائب', 'Bags'], shoes: ['أحذية', 'Shoes'], accessories: ['إكسسوارات', 'Accessories'], other: ['أخرى', 'Other'] };
const SORTS = { soon: ['ينتهي قريباً', 'Ending soon'], high: ['الأعلى سعراً', 'Highest price'], bids: ['الأكثر مزايدة', 'Most bids'] };
const inputCls = 'w-full bg-transparent px-4 py-3 text-sm outline-none focus:border-[#ece8df]';
const inputStyle = { border: `1px solid ${HAIR}`, color: INK };

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toAr = (s) => String(s).replace(/[0-9]/g, (d) => AR_DIGITS[d]);

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}
function timeLeft(endsAt, now, isAr) {
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return { done: true, soon: false, text: isAr ? 'انتهى' : 'Ended' };
  const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
  const pad = (n) => String(n).padStart(2, '0');
  const t = d > 0 ? `${d}${isAr ? 'ي' : 'd'} ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  return { done: false, soon: diff < 36e5, text: isAr ? toAr(t) : t };
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

// ── بطاقة قطعة ──
function AuctionCard({ l, isAr, now, onBid }) {
  const [after, setAfter] = useState(true);
  const t = timeLeft(l.ends_at, now, isAr);
  const hasPair = l.before_image_url && l.after_image_url;
  const img = hasPair ? (after ? l.after_image_url : l.before_image_url) : l.image_url || l.after_image_url;
  const title = isAr ? l.title_ar : l.title || l.title_ar;
  return (
    <motion.article initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-col" style={{ border: `1px solid ${HAIR}`, background: '#0f0f11' }}>
      <div className="relative" style={{ aspectRatio: '4 / 5', background: '#131315' }}>
        {img ? <img src={img} alt={title} loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Gavel className="w-10 h-10" style={{ color: '#3a3a3e' }} /></div>}
        <div className="absolute top-3 start-3 flex flex-col gap-1.5 items-start">
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-bold" style={{ background: t.done ? '#3a3a3e' : t.soon ? '#b91c1c' : 'rgba(11,11,12,.85)', color: '#fff', backdropFilter: 'blur(6px)' }}>
            {t.soon && !t.done ? <Flame className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}{t.text}
          </span>
          {l.is_featured && <span className="px-2.5 h-6 inline-flex items-center text-[10px] font-bold tracking-wide" style={{ background: INK, color: '#0b0b0c' }}>{isAr ? 'مميزة' : 'FEATURED'}</span>}
        </div>
        {hasPair && (
          <button onClick={() => setAfter((v) => !v)} className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold" style={{ background: 'rgba(11,11,12,.85)', color: INK, border: `1px solid ${HAIR}` }}>
            <ArrowLeftRight className="w-3.5 h-3.5" />{after ? (isAr ? 'شاهد قبل الترميم' : 'See before') : (isAr ? 'شاهد بعد الترميم' : 'See after')}
          </button>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        {l.brand && <span className="text-[11px] tracking-wide" style={{ color: MUTED }}>{isAr ? l.brand.name_ar || l.brand.name : l.brand.name || l.brand.name_ar}</span>}
        <h3 className="font-semibold leading-snug line-clamp-2" style={{ color: INK }}>{title}</h3>
        <div className="flex items-end justify-between mt-auto pt-2">
          <div>
            <p className="text-[10px] mb-0.5" style={{ color: MUTED }}>{l.bid_count > 0 ? (isAr ? 'أعلى مزايدة' : 'Current bid') : (isAr ? 'سعر البداية' : 'Starting price')}</p>
            <span className="text-lg font-bold" style={{ color: INK }}><SarAmount value={l.bid_count > 0 ? l.current_price : l.starting_price} decimals={0} /></span>
          </div>
          <div className="text-end text-[11px]" style={{ color: MUTED }}>
            <div>{isAr ? `${toAr(l.bid_count)} مزايدة` : `${l.bid_count} bids`}</div>
            {l.top_bidder && <div>{isAr ? 'الأعلى:' : 'Top:'} {l.top_bidder}</div>}
          </div>
        </div>
        <button onClick={() => onBid(l)} disabled={t.done} className="mt-2 min-h-[46px] font-semibold text-sm disabled:opacity-40" style={{ background: t.done ? '#2a2a2d' : INK, color: t.done ? '#8d8a82' : '#0b0b0c' }}>
          {t.done ? (isAr ? 'انتهى المزاد' : 'Auction ended') : (isAr ? 'زايد الآن' : 'Place bid')}
        </button>
      </div>
    </motion.article>
  );
}

function Modal({ children, onClose, dir }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir={dir}>
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="relative w-full sm:max-w-md max-h-[92svh] overflow-y-auto p-6" style={{ background: '#0b0b0c', border: `1px solid ${HAIR}`, color: INK }}>
        <button onClick={onClose} className="absolute top-4 end-4" style={{ color: MUTED }} aria-label="close"><X className="w-5 h-5" /></button>
        {children}
      </motion.div>
    </div>
  );
}

// ── نافذة المزايدة ──
function BidDialog({ listing, isAr, dir, onClose, onSuccess }) {
  const inc = Number(listing.bid_increment) || 10;
  const base = listing.bid_count > 0 ? Number(listing.current_price) : Number(listing.starting_price);
  const minBid = listing.bid_count > 0 ? base + inc : Math.max(base, inc);
  const [name, setName] = useState(() => { try { return localStorage.getItem('auc_name') || ''; } catch { return ''; } });
  const [phone, setPhone] = useState(() => { try { return localStorage.getItem('auc_phone') || ''; } catch { return ''; } });
  const [amount, setAmount] = useState(String(minBid));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: history = [] } = useQuery({ queryKey: ['auction-bids', listing.id], queryFn: () => rpc('auction_bids_public', { p_listing: listing.id }), refetchInterval: 8000 });

  const submit = async () => {
    setError('');
    if (!name.trim() || !phone.trim()) return setError(isAr ? 'الاسم والجوال مطلوبان' : 'Name and phone are required');
    if (Number(amount) < minBid) return setError(isAr ? `أقل مزايدة مقبولة ${minBid} ر.س` : `Minimum bid is ${minBid} SAR`);
    setBusy(true);
    try {
      const r = await rpc('auction_place_bid', { p_listing: listing.id, p_name: name.trim(), p_phone: phone.trim(), p_amount: Number(amount) });
      if (!r?.ok) throw new Error(r?.error || 'error');
      try { localStorage.setItem('auc_name', name.trim()); localStorage.setItem('auc_phone', phone.trim()); } catch { /* ignore */ }
      onSuccess();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} dir={dir}>
      <h3 className="text-lg font-semibold pe-8 mb-1">{isAr ? listing.title_ar : listing.title || listing.title_ar}</h3>
      <p className="text-sm mb-4" style={{ color: MUTED }}>{isAr ? 'الحد الأدنى للمزايدة' : 'Minimum bid'}: <b style={{ color: INK }}><SarAmount value={minBid} decimals={0} /></b></p>
      <div className="flex gap-2 mb-3">
        {[0, 1, 3].map((k) => { const v = minBid + inc * k; return (
          <button key={k} onClick={() => setAmount(String(v))} className="flex-1 min-h-[40px] text-sm" style={{ border: `1px solid ${Number(amount) === v ? INK : HAIR}`, color: INK }}><SarAmount value={v} decimals={0} /></button>
        ); })}
      </div>
      <div className="space-y-3">
        <input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={isAr ? 'الاسم' : 'Name'} maxLength={80} />
        <input className={inputCls} style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" dir="ltr" inputMode="tel" />
        <input className={inputCls + ' font-bold'} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={minBid} dir="ltr" />
        <p className="text-[11px]" style={{ color: MUTED }}>{isAr ? 'بالمتابعة توافق على معالجة بياناتك لأغراض المزاد وفق ' : 'By continuing you agree to your data being processed for the auction per the '}<a href={isAr ? '/privacy' : '/en/privacy'} target="_blank" rel="noreferrer" className="underline">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</a></p>
        {error && <p className="text-xs font-bold" style={{ color: '#f87171' }}>{error}</p>}
        <button onClick={submit} disabled={busy} className="w-full min-h-[50px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: INK, color: '#0b0b0c' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAr ? 'تأكيد المزايدة' : 'Confirm bid')}
        </button>
        <p className="text-[11px]" style={{ color: MUTED }}>{isAr ? 'إذا زايد أحد في آخر 3 دقائق يُمدَّد المزاد 3 دقائق. يتواصل معك فريقنا عند الفوز.' : 'A bid in the final 3 minutes extends the auction by 3 minutes. Our team will contact you if you win.'}</p>
      </div>
      {history.length > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
          <p className="text-xs mb-2" style={{ color: MUTED }}>{isAr ? 'آخر المزايدات' : 'Recent bids'}</p>
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-sm py-1" style={{ color: i === 0 ? INK : '#a8a398' }}><span>{h.name}</span><span><SarAmount value={h.amount} decimals={0} /></span></div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── نافذة عرض قطعة للبيع ──
function SubmitItemDialog({ isAr, dir, brands, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', phone: '', category: 'bags', brand_id: '', title_ar: '', description_ar: '' });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.phone.trim() || !form.title_ar.trim()) return setError(isAr ? 'الاسم والجوال ووصف القطعة مطلوبة' : 'Name, phone and item description are required');
    setBusy(true);
    try {
      let image_url = null;
      if (photo) {
        if (photo.size > 5 * 1024 * 1024) throw new Error(isAr ? 'حجم الصورة أكبر من 5 ميجا' : 'Photo is larger than 5 MB');
        image_url = (await storage.uploadFile({ file: photo, bucket: 'auction-submissions' })).file_url;
      }
      const r = await rpc('auction_submit_item', { p: { ...form, image_url } });
      if (!r?.ok) throw new Error(r?.error || 'error');
      onSuccess();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} dir={dir}>
      <h3 className="text-lg font-semibold mb-1">{isAr ? 'اعرض قطعتك للبيع بالمزاد' : 'Sell your piece at auction'}</h3>
      <p className="text-xs mb-5" style={{ color: MUTED }}>{isAr ? 'نراجع طلبك ونتواصل معك لتحديد سعر البداية ووقت الانتهاء قبل نشر القطعة.' : 'We review your request and contact you to set the starting price and end time before publishing.'}</p>
      <div className="space-y-3">
        <input className={inputCls} style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={isAr ? 'اسمك' : 'Your name'} maxLength={80} />
        <input className={inputCls} style={inputStyle} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05XXXXXXXX" dir="ltr" inputMode="tel" />
        <select className={inputCls} style={{ ...inputStyle, background: '#0b0b0c' }} value={form.category} onChange={(e) => set('category', e.target.value)}>
          {Object.entries(CATS).filter(([k]) => k !== 'all').map(([k, v]) => <option key={k} value={k}>{v[isAr ? 0 : 1]}</option>)}
        </select>
        {brands.length > 0 && (
          <select className={inputCls} style={{ ...inputStyle, background: '#0b0b0c' }} value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)}>
            <option value="">{isAr ? 'البراند (اختياري)' : 'Brand (optional)'}</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name_ar || b.name}</option>)}
          </select>
        )}
        <input className={inputCls} style={inputStyle} value={form.title_ar} onChange={(e) => set('title_ar', e.target.value)} placeholder={isAr ? 'وصف مختصر للقطعة' : 'Short description'} maxLength={160} />
        <textarea className={inputCls} style={inputStyle} rows={2} value={form.description_ar} onChange={(e) => set('description_ar', e.target.value)} placeholder={isAr ? 'تفاصيل الحالة (اختياري)' : 'Condition details (optional)'} maxLength={600} />
        <label className="block text-xs" style={{ color: MUTED }}>{isAr ? 'صورة القطعة (اختياري)' : 'Photo (optional)'}
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="block mt-1 w-full text-xs" />
        </label>
        <p className="text-[11px]" style={{ color: MUTED }}>{isAr ? 'بالمتابعة توافق على معالجة بياناتك لأغراض المزاد وفق ' : 'By continuing you agree to your data being processed for the auction per the '}<a href={isAr ? '/privacy' : '/en/privacy'} target="_blank" rel="noreferrer" className="underline">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</a></p>
        {error && <p className="text-xs font-bold" style={{ color: '#f87171' }}>{error}</p>}
        <button onClick={submit} disabled={busy} className="w-full min-h-[50px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: INK, color: '#0b0b0c' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAr ? 'إرسال الطلب' : 'Submit request')}
        </button>
      </div>
    </Modal>
  );
}

function Toast({ show, text }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-6 inset-x-0 flex justify-center z-[60] px-4">
          <div className="px-6 py-3 text-sm font-semibold flex items-center gap-2" style={{ background: INK, color: '#0b0b0c' }}><Check className="w-4 h-4" />{text}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AuctionMarket() {
  const { dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const prefix = isAr ? '' : '/en';
  const qc = useQueryClient();
  const now = useNow();
  const [bidFor, setBidFor] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [brandId, setBrandId] = useState(null);
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('soon');

  const { data: brands = [] } = useQuery({ queryKey: ['brands-active'], queryFn: () => db.Brand.list('sort_order', 100) });
  const { data: auctions = [], isLoading } = useQuery({ queryKey: ['auctions-active'], queryFn: () => rpc('auction_public_list'), refetchInterval: 10000 });

  const list = useMemo(() => {
    let a = auctions.filter((l) => (!brandId || l.brand_id === brandId) && (cat === 'all' || l.category === cat));
    const live = (l) => new Date(l.ends_at).getTime() > now;
    const cmp = { soon: (x, y) => new Date(x.ends_at) - new Date(y.ends_at), high: (x, y) => y.current_price - x.current_price, bids: (x, y) => y.bid_count - x.bid_count }[sort];
    return [...a.filter(live).sort(cmp), ...a.filter((l) => !live(l)).sort((x, y) => new Date(y.ends_at) - new Date(x.ends_at))];
  }, [auctions, brandId, cat, sort, now]);
  const liveCount = auctions.filter((l) => new Date(l.ends_at).getTime() > now).length;
  const usedBrands = brands.filter((b) => auctions.some((l) => l.brand_id === b.id));

  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 3500); };
  const seo = isAr ? AUCTION_SEO : AUCTION_SEO.en;
  const steps = isAr
    ? [['١', 'اختر القطعة', 'تصفّح الصور وحالة الترميم قبل وبعد.'], ['٢', 'زايد', 'أدخل بياناتك ومبلغك، والحد الأدنى يظهر لك.'], ['٣', 'اربح', 'صاحب أعلى مزايدة عند الانتهاء يفوز ونتواصل معه.']]
    : [['1', 'Pick a piece', 'Browse photos and the restoration condition.'], ['2', 'Place a bid', 'Enter your details and amount — the minimum is shown.'], ['3', 'Win', 'The highest bid at the end wins and we contact you.']];

  return (
    <div dir={dir} className="min-h-screen" style={{ background: '#0b0b0c', color: INK }}>
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={`${SITE}${prefix}/auction`} />
        <link rel="alternate" hrefLang="ar" href={`${SITE}/auction`} />
        <link rel="alternate" hrefLang="en" href={`${SITE}/en/auction`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE}/auction`} />
      </Helmet>

      <header className="sticky top-0 z-40 h-16 px-4 sm:px-6 grid grid-cols-3 items-center" style={{ background: 'rgba(11,11,12,.92)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${HAIR}` }}>
        <Link to={prefix || '/'} className="justify-self-start text-sm" style={{ color: '#bdb8ad' }}>{isAr ? '← الرئيسية' : '← Home'}</Link>
        <Link to={prefix || '/'} className="justify-self-center"><img src="/images/cobblers-official-mark-white.png" alt="Ebra & Khait Cobbler" className="h-9 w-auto" /></Link>
        <div className="justify-self-end flex items-center gap-3"><LanguageSwitcher /></div>
      </header>

      <section className="max-w-3xl mx-auto px-5 pt-14 pb-10 text-center">
        <p className="text-xs tracking-[0.35em] uppercase mb-4" style={{ color: MUTED }}>{isAr ? 'مزايدة مباشرة' : 'Live auction'}</p>
        <h1 className="text-3xl sm:text-5xl font-light leading-tight mb-4">{isAr ? 'سوق المزاد' : 'Auction Market'}</h1>
        <p className="font-light leading-loose max-w-xl mx-auto mb-6" style={{ color: '#a8a398' }}>
          {isAr ? 'حقائب وأحذية جلدية رمّمناها بأيدي حرفيينا، تُعرض للمزايدة المباشرة. زايد على ما يعجبك وتابع الوقت المتبقي لحظة بلحظة.' : 'Leather bags and shoes restored by our craftsmen, offered for live bidding. Bid on what you love and follow the countdown in real time.'}
        </p>
        <button onClick={() => setSubmitOpen(true)} className="px-8 min-h-[48px] text-sm font-semibold" style={{ border: `1px solid ${INK}`, color: INK }}>{isAr ? 'بيع قطعتك بالمزاد' : 'Sell your piece'}</button>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-10">
        <div className="grid sm:grid-cols-3 gap-px" style={{ background: HAIR }}>
          {steps.map(([n, t, d]) => (
            <div key={t} className="p-5" style={{ background: '#0b0b0c' }}>
              <div className="text-2xl font-light mb-2" style={{ color: MUTED }}>{n}</div>
              <div className="font-semibold mb-1">{t}</div><div className="text-sm font-light" style={{ color: '#a8a398' }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {Object.entries(CATS).map(([k, v]) => (
              <button key={k} onClick={() => setCat(k)} className="shrink-0 px-4 h-9 text-xs font-semibold" style={cat === k ? { background: INK, color: '#0b0b0c' } : { border: `1px solid ${HAIR}`, color: '#bdb8ad' }}>{v[isAr ? 0 : 1]}</button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 px-3 text-xs bg-transparent" style={{ border: `1px solid ${HAIR}`, color: INK }}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k} style={{ background: '#0b0b0c' }}>{v[isAr ? 0 : 1]}</option>)}
          </select>
        </div>
        {usedBrands.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setBrandId(null)} className="shrink-0 px-4 h-9 text-xs" style={!brandId ? { background: INK, color: '#0b0b0c' } : { border: `1px solid ${HAIR}`, color: '#bdb8ad' }}>{isAr ? 'كل البراندات' : 'All brands'}</button>
            {usedBrands.map((b) => (
              <button key={b.id} onClick={() => setBrandId(brandId === b.id ? null : b.id)} className="shrink-0 flex items-center gap-2 px-4 h-9 text-xs" style={brandId === b.id ? { background: INK, color: '#0b0b0c' } : { border: `1px solid ${HAIR}`, color: '#bdb8ad' }}>
                {b.logo_url && <img src={b.logo_url} alt="" className="h-4 w-auto" loading="lazy" />}{b.name_ar || b.name}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs mb-4" style={{ color: MUTED }}>{isAr ? `${toAr(liveCount)} مزاد جارٍ الآن` : `${liveCount} live auctions`}</p>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-96 animate-pulse" style={{ background: 'rgba(255,255,255,.05)' }} />)}</div>
        ) : list.length === 0 ? (
          <div className="text-center py-20 px-4" style={{ border: `1px dashed ${HAIR}` }}>
            <Gavel className="w-8 h-8 mx-auto mb-4" style={{ color: MUTED }} />
            <p className="mb-2">{isAr ? 'لا توجد مزادات جارية حالياً' : 'No live auctions right now'}</p>
            <p className="text-sm font-light mb-6" style={{ color: MUTED }}>{isAr ? 'تُضاف قطع جديدة باستمرار — ويمكنك عرض قطعتك الخاصة.' : 'New pieces are added regularly — and you can submit your own.'}</p>
            <Link to={`${prefix}/shop`} className="text-sm underline" style={{ color: '#bdb8ad' }}>{isAr ? 'تسوّق منتجات العناية بالجلود' : 'Shop leather care products'}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{list.map((l) => <AuctionCard key={l.id} l={l} isAr={isAr} now={now} onBid={setBidFor} />)}</div>
        )}
      </section>

      {bidFor && <BidDialog listing={bidFor} isAr={isAr} dir={dir} onClose={() => setBidFor(null)}
        onSuccess={() => { setBidFor(null); flash(isAr ? 'تم تسجيل مزايدتك بنجاح' : 'Your bid was placed'); qc.invalidateQueries({ queryKey: ['auctions-active'] }); }} />}
      {submitOpen && <SubmitItemDialog isAr={isAr} dir={dir} brands={brands} onClose={() => setSubmitOpen(false)}
        onSuccess={() => { setSubmitOpen(false); flash(isAr ? 'وصلنا طلبك، سنتواصل معك قريباً' : "Got it — we'll contact you soon"); }} />}
      <Toast show={!!toast} text={toast} />
    </div>
  );
}
