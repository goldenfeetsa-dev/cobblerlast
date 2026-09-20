import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { db, listActiveAuctions, listShopProductsWithBrand, placeBid, storage } from '@/api/supabaseApi';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// ── أيقونات SVG أصلية (نفس تصميم أيقونات الصفحة الرئيسية بالضبط —
// لا إيموجي إطلاقاً، طبقاً لطلب العميل الصريح) ──────────────────────
function ToolboxIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="9" width="18" height="10" rx="2"></rect>
      <path d="M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"></path>
      <line x1="3" y1="13" x2="21" y2="13"></line>
      <line x1="12" y1="11" x2="12" y2="15"></line>
    </svg>
  );
}
function GavelIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="8.5" y="2.5" width="5" height="9" rx="1" transform="rotate(45 11 7)"></rect>
      <line x1="7" y1="12.5" x2="3" y2="16.5"></line>
      <line x1="9.5" y1="15" x2="5.5" y2="19"></line>
      <line x1="3" y1="21" x2="9" y2="21"></line>
    </svg>
  );
}
function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9"></circle>
      <polyline points="12 7 12 12 15.5 14"></polyline>
    </svg>
  );
}

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicDigits(s) { return String(s).replace(/[0-9]/g, (d) => AR_DIGITS[d]); }

function useCountdown(endsAt, isAr) {
  const target = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = target - now;
  if (diff <= 0) return { done: true, text: isAr ? toArabicDigits('٠٠:٠٠:٠٠') : '00:00:00' };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const text = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return { done: false, text: isAr ? toArabicDigits(text) : text };
}

function BrandBadge({ brand }) {
  if (!brand) return null;
  return (
    <div className="flex items-center gap-1.5">
      {brand.logo_url && (
        <img src={brand.logo_url} alt={brand.name_ar || brand.name} className="h-4 w-auto object-contain opacity-80" loading="lazy" />
      )}
      <span className="text-[11px] font-bold" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {brand.name_ar || brand.name}
      </span>
    </div>
  );
}

function formatSAR(n, isAr) {
  const num = Math.round(Number(n) || 0);
  return isAr ? `${toArabicDigits(num)} ر.س` : `${num} SAR`;
}

// ── بطاقة قطعة دكّة الإسكافي (شراء فوري) ────────────────────────────
function ShopItemCard({ product, isAr }) {
  const discount = product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="rounded-2xl overflow-hidden flex flex-col h-full transition-transform duration-300 hover:-translate-y-1"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 1px 2px rgba(36,20,11,0.10)' }}>
      <div className="relative overflow-hidden" style={{ height: 180 }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name_ar} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--secondary))' }}>
            <ToolboxIcon className="w-8 h-8" style={{ color: 'hsl(var(--secondary-foreground))' }} />
          </div>
        )}
        {discount > 0 && (
          <div className="absolute top-3 start-3 px-2 py-1 rounded-full text-xs font-bold text-white" style={{ background: 'hsl(var(--destructive))' }}>
            -{toArabicDigits(discount)}%
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-black text-sm mb-1" style={{ color: 'hsl(var(--foreground))' }}>{product.name_ar}</h3>
        <BrandBadge brand={product.brand} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="text-base font-black" style={{ color: 'hsl(var(--brand-brass))' }}>{formatSAR(product.price, isAr)}</span>
            {product.original_price && (
              <span className="text-xs line-through ms-2" style={{ color: 'hsl(var(--muted-foreground))' }}>{formatSAR(product.original_price, isAr)}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── بطاقة قطعة سوق المزاد (مزايدة مباشرة) ───────────────────────────
function AuctionCard({ listing, isAr, onBidClick }) {
  const { text, done } = useCountdown(listing.ends_at, isAr);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="rounded-2xl overflow-hidden flex flex-col h-full relative transition-transform duration-300 hover:-translate-y-1"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 18px 36px -14px rgba(36,20,11,0.36)' }}>
      <div className="absolute top-3 start-3 z-10 flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-white text-[11px] font-black"
        style={{ background: done ? 'hsl(var(--muted-foreground))' : 'hsl(var(--destructive))' }}>
        <ClockIcon className="w-3.5 h-3.5" />{text}
      </div>
      <div className="relative overflow-hidden" style={{ height: 180 }}>
        {listing.image_url ? (
          <img src={listing.image_url} alt={listing.title_ar} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--secondary))' }}>
            <GavelIcon className="w-8 h-8" style={{ color: 'hsl(var(--secondary-foreground))' }} />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-black text-sm mb-1" style={{ color: 'hsl(var(--foreground))' }}>{listing.title_ar}</h3>
        <BrandBadge brand={listing.brand} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-[10px] font-bold mb-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{isAr ? 'أعلى مزايدة حالياً' : 'Current bid'}</p>
            <span className="text-base font-black" style={{ color: 'hsl(var(--brand-brass))' }}>{formatSAR(listing.current_price, isAr)}</span>
          </div>
          <button onClick={() => onBidClick(listing)} disabled={done}
            className="px-4 py-2 rounded-full text-xs font-bold disabled:opacity-40 transition-transform hover:scale-105"
            style={{ background: done ? 'hsl(var(--muted))' : 'hsl(var(--brand-brass))', color: 'hsl(var(--foreground))' }}>
            {done ? (isAr ? 'انتهى المزاد' : 'Ended') : (isAr ? 'زايد الآن' : 'Bid now')}
          </button>
        </div>
        <div className="flex justify-between text-[11px] mt-2 pt-2" style={{ color: 'hsl(var(--muted-foreground))', borderTop: '1px dashed hsl(var(--border))' }}>
          <span>{isAr ? `${toArabicDigits(listing.bid_count)} مزايدة` : `${listing.bid_count} bids`}</span>
          <span>{isAr ? 'الحد الأدنى للمزايدة التالية' : 'Next min. bid'}: {formatSAR(Number(listing.current_price) + Number(listing.bid_increment), isAr)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── نافذة المزايدة ───────────────────────────────────────────────────
function BidDialog({ listing, isAr, dir, onClose, onSuccess }) {
  const minBid = Number(listing.current_price) + Number(listing.bid_increment);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(String(minBid));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!name.trim() || !phone.trim()) { setError(isAr ? 'الاسم والجوال مطلوبان' : 'Name and phone are required'); return; }
    if (Number(amount) < minBid) { setError(isAr ? `أقل مزايدة مقبولة ${minBid} ر.س` : `Minimum bid is ${minBid} SAR`); return; }
    setLoading(true);
    try {
      await placeBid({ listingId: listing.id, bidderName: name.trim(), bidderPhone: phone.trim(), amount: Number(amount) });
      onSuccess();
    } catch (e) {
      setError(e.message || (isAr ? 'تعذّر تسجيل المزايدة' : 'Could not place bid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir={dir}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm rounded-2xl p-6 z-10" style={{ background: 'hsl(var(--card))' }}>
        <button onClick={onClose} className="absolute top-4 start-4" style={{ color: 'hsl(var(--muted-foreground))' }}><X className="w-5 h-5" /></button>
        <h3 className="font-black text-lg mb-1 text-center" style={{ color: 'hsl(var(--foreground))' }}>{listing.title_ar}</h3>
        <p className="text-xs text-center mb-5" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {isAr ? `الحد الأدنى للمزايدة: ${minBid} ر.س` : `Minimum bid: ${minBid} SAR`}
        </p>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isAr ? 'الاسم' : 'Name'}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={isAr ? 'رقم الجوال' : 'Phone'} dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={minBid} placeholder={isAr ? 'مبلغ المزايدة' : 'Bid amount'} dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none font-bold" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          {error && <p className="text-xs font-bold" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>}
          <button onClick={submit} disabled={loading}
            className="w-full py-3.5 rounded-full font-bold text-sm disabled:opacity-50" style={{ background: 'hsl(var(--brand-brass))', color: 'hsl(var(--foreground))' }}>
            {loading ? (isAr ? 'جارِ الإرسال...' : 'Submitting...') : (isAr ? 'أرسل مزايدتي' : 'Submit bid')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── نافذة "اعرض قطعتك" — العميل يقدّم طلب عرض قطعته بالمزاد، وتظهر
// عند فريق العمل بحالة "بانتظار المراجعة" (pending) لحد ما يراجعوها
// ويحددوا السعر الابتدائي ووقت الانتهاء الفعلي، فتصير نشطة للجميع.
function SubmitItemDialog({ isAr, dir, brands, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', phone: '', category: 'bags', brand_id: '', title_ar: '', description_ar: '' });
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.phone.trim() || !form.title_ar.trim()) {
      setError(isAr ? 'الاسم والجوال واسم القطعة مطلوبين' : 'Name, phone and item title are required');
      return;
    }
    setUploading(true);
    try {
      let image_url = null;
      if (photo) {
        const { file_url } = await storage.uploadFile({ file: photo, bucket: 'auction-submissions' });
        image_url = file_url;
      }
      await db.AuctionListing.create({
        title: form.title_ar,
        title_ar: form.title_ar,
        description_ar: form.description_ar || null,
        category: form.category,
        brand_id: form.brand_id || null,
        image_url,
        status: 'pending',
        starting_price: 0,
        current_price: 0,
        bid_increment: 10,
        ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        submitter_name: form.name.trim(),
        submitter_phone: form.phone.trim(),
      });
      onSuccess();
    } catch (e) {
      setError(e.message || (isAr ? 'تعذّر إرسال الطلب' : 'Could not submit'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir={dir}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl p-6 z-10 max-h-[90vh] overflow-y-auto" style={{ background: 'hsl(var(--card))' }}>
        <button onClick={onClose} className="absolute top-4 start-4" style={{ color: 'hsl(var(--muted-foreground))' }}><X className="w-5 h-5" /></button>
        <h3 className="font-black text-lg mb-1 text-center" style={{ color: 'hsl(var(--foreground))' }}>{isAr ? 'اعرض قطعتك بالمزاد' : 'Submit your piece'}</h3>
        <p className="text-xs text-center mb-5" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {isAr ? 'نراجع طلبك ونتواصل معك لتحديد سعر البداية قبل ما تظهر بالمزاد' : "We'll review and contact you to set a starting price before it goes live"}
        </p>
        <div className="space-y-3">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={isAr ? 'اسمك' : 'Your name'}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder={isAr ? 'رقم جوالك' : 'Your phone'} dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          <select value={form.category} onChange={(e) => set('category', e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
            <option value="bags">{isAr ? 'حقيبة' : 'Bag'}</option>
            <option value="shoes">{isAr ? 'حذاء' : 'Shoes'}</option>
            <option value="accessories">{isAr ? 'إكسسوار' : 'Accessory'}</option>
            <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
          </select>
          {brands.length > 0 && (
            <select value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
              <option value="">{isAr ? 'البراند (اختياري)' : 'Brand (optional)'}</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name_ar || b.name}</option>)}
            </select>
          )}
          <input value={form.title_ar} onChange={(e) => set('title_ar', e.target.value)} placeholder={isAr ? 'وصف مختصر للقطعة' : 'Short item description'}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          <textarea value={form.description_ar} onChange={(e) => set('description_ar', e.target.value)} placeholder={isAr ? 'تفاصيل إضافية عن حالة القطعة (اختياري)' : 'Extra details about condition (optional)'} rows={2}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          <label className="block">
            <span className="text-xs font-bold mb-1 block" style={{ color: 'hsl(var(--muted-foreground))' }}>{isAr ? 'صورة القطعة (اختياري)' : 'Photo (optional)'}</span>
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="w-full text-xs" />
          </label>
          {error && <p className="text-xs font-bold" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>}
          <button onClick={submit} disabled={uploading}
            className="w-full py-3.5 rounded-full font-bold text-sm disabled:opacity-50" style={{ background: 'hsl(var(--brand-brass))', color: 'hsl(var(--foreground))' }}>
            {uploading ? (isAr ? 'جارِ الإرسال...' : 'Submitting...') : (isAr ? 'أرسل طلب العرض' : 'Submit for review')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── شريط فلترة بالبراند — يظهر شعارات البراندات الحقيقية اللي رفعها
// المتجر (Gucci, Dior, Hermes...)، الضغط على أي وحدة يفلتر كل من
// دكّة الإسكافي وسوق المزاد بنفس البراند
function BrandFilterBar({ brands, selectedBrandId, onSelect, isAr }) {
  if (brands.length === 0) return null;
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 mb-8 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
      <button onClick={() => onSelect(null)}
        className="shrink-0 px-4 h-11 rounded-full text-xs font-black transition-all"
        style={{
          background: selectedBrandId === null ? 'hsl(var(--brand-brass))' : 'hsl(var(--card))',
          color: selectedBrandId === null ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          border: '1px solid hsl(var(--border))',
        }}>
        {isAr ? 'كل البراندات' : 'All brands'}
      </button>
      {brands.map((b) => (
        <button key={b.id} onClick={() => onSelect(b.id === selectedBrandId ? null : b.id)}
          className="shrink-0 flex items-center gap-2 px-4 h-11 rounded-full transition-all"
          style={{
            background: selectedBrandId === b.id ? 'hsl(var(--brand-brass))' : 'hsl(var(--card))',
            border: selectedBrandId === b.id ? '1px solid hsl(var(--brand-brass))' : '1px solid hsl(var(--border))',
          }}>
          {b.logo_url && <img src={b.logo_url} alt={b.name_ar || b.name} className="h-5 w-auto object-contain" loading="lazy" />}
          <span className="text-xs font-bold" style={{ color: selectedBrandId === b.id ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
            {b.name_ar || b.name}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function AuctionMarket() {
  const { dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const [activeBidListing, setActiveBidListing] = useState(null);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const queryClient = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => db.Brand.list('sort_order', 100),
  });
  const { data: shopProducts = [] } = useQuery({
    queryKey: ['products-public-with-brand'],
    queryFn: () => listShopProductsWithBrand(),
  });
  const { data: auctions = [] } = useQuery({
    queryKey: ['auctions-active'],
    queryFn: () => listActiveAuctions(),
    refetchInterval: 15000, // تحديث دوري خفيف — يعكس مزايدات المستخدمين الآخرين بدون إعادة تحميل الصفحة
  });

  // فلترة بالبراند المختار — تطبّق على القسمين معاً (الدكّة والمزاد)
  const filteredShopProducts = selectedBrandId ? shopProducts.filter((p) => p.brand?.id === selectedBrandId || p.brand_id === selectedBrandId) : shopProducts;
  const filteredAuctions = selectedBrandId ? auctions.filter((l) => l.brand?.id === selectedBrandId || l.brand_id === selectedBrandId) : auctions;

  const handleBidSuccess = () => {
    setActiveBidListing(null);
    setBidSuccess(true);
    queryClient.invalidateQueries({ queryKey: ['auctions-active'] });
    setTimeout(() => setBidSuccess(false), 3000);
  };

  const handleSubmitSuccess = () => {
    setSubmitOpen(false);
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 4000);
  };

  return (
    <div dir={dir} style={{ background: 'hsl(var(--background))', minHeight: '100vh' }} className="font-tajawal">
      <Helmet>
        <title>{isAr ? 'دكّة الإسكافي وسوق المزاد | إبرة وخيط الإسكافي — الرياض' : "Cobbler's Bench & Auction Market | Cobblers — Riyadh"}</title>
        <meta name="description" content={isAr
          ? 'تسوّق مستلزمات وقطع مجدّدة بسعر ثابت من دكّة الإسكافي، أو زايد مباشرة على قطع جلدية فاخرة نادرة في سوق المزاد.'
          : 'Shop fixed-price refurbished pieces from the Cobbler\'s Bench, or bid live on rare refurbished leather pieces in the Auction Market.'} />
        <link rel="canonical" href="https://needlecobbler.com/auction" />
      </Helmet>

      {/* Nav */}
      <nav className="sticky top-0 z-40 px-6 h-16 flex items-center justify-between backdrop-blur-md"
        style={{ background: 'hsl(var(--card) / 0.95)', borderBottom: '1px solid hsl(var(--border))' }}>
        <Link to="/" className="flex items-center gap-2">
          <img src="/images/cobblers-official-mark.png" alt="Cobblers" className="w-8 h-8 object-contain" />
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-bold" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <Link to="/" className="hover:opacity-70">{isAr ? 'الرئيسية' : 'Home'}</Link>
          <a href="#dekka" className="hover:opacity-70">{isAr ? 'دكّة الإسكافي' : "Cobbler's Bench"}</a>
          <a href="#mazad" className="hover:opacity-70">{isAr ? 'سوق المزاد' : 'Auction'}</a>
          <Link to="/my-bookings" className="hover:opacity-70">{isAr ? 'تتبّع طلبك' : 'Track order'}</Link>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={() => setSubmitOpen(true)}
            className="px-4 h-9 rounded-full text-xs font-bold flex items-center" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            {isAr ? 'بيع قطعتك' : 'Sell your piece'}
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-8">
        <BrandFilterBar brands={brands} selectedBrandId={selectedBrandId} onSelect={setSelectedBrandId} isAr={isAr} />
      </div>

      {/* Section A: دكّة الإسكافي */}
      <section id="dekka" className="max-w-7xl mx-auto px-6 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}>
            <ToolboxIcon className="w-5.5 h-5.5" style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <p className="text-xs font-black tracking-widest uppercase" style={{ color: 'hsl(var(--secondary-foreground))' }}>
              {isAr ? 'شراء فوري · سعر ثابت' : 'Buy now · Fixed price'}
            </p>
            <h1 className="font-display font-bold text-2xl" style={{ color: 'hsl(var(--foreground))' }}>{isAr ? 'دكّة الإسكافي' : "Cobbler's Bench"}</h1>
          </div>
        </div>
        {filteredShopProducts.length === 0 ? (
          <p className="text-sm py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>{isAr ? 'لا توجد قطع معروضة حالياً' : 'No items available right now'}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4">
            {filteredShopProducts.slice(0, 8).map((p) => <ShopItemCard key={p.id} product={p} isAr={isAr} />)}
          </div>
        )}
        <div className="text-center pb-4">
          <Link to="/shop" className="text-sm font-bold hover:opacity-70" style={{ color: 'hsl(var(--brand-brass))' }}>
            {isAr ? 'عرض كل القطع ←' : 'View all items →'}
          </Link>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6"><div style={{ borderTop: '2px dashed hsl(var(--border))' }} /></div>

      {/* Section B: سوق المزاد */}
      <section id="mazad" className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--brand-brass))', color: 'hsl(var(--foreground))' }}>
            <GavelIcon style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <p className="text-xs font-black tracking-widest uppercase" style={{ color: 'hsl(var(--brand-brass))' }}>
              {isAr ? 'مزايدة مباشرة · قطع نادرة' : 'Live bidding · Rare pieces'}
            </p>
            <h1 className="font-display font-bold text-2xl" style={{ color: 'hsl(var(--foreground))' }}>{isAr ? 'سوق المزاد' : 'Auction Market'}</h1>
          </div>
        </div>
        {filteredAuctions.length === 0 ? (
          <p className="text-sm py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>{isAr ? 'لا توجد مزادات نشطة حالياً — تابعنا قريباً' : 'No active auctions right now — check back soon'}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 pb-8">
            {filteredAuctions.map((l) => <AuctionCard key={l.id} listing={l} isAr={isAr} onBidClick={setActiveBidListing} />)}
          </div>
        )}
      </section>

      <AnimatePresence>
        {activeBidListing && (
          <BidDialog listing={activeBidListing} isAr={isAr} dir={dir} onClose={() => setActiveBidListing(null)} onSuccess={handleBidSuccess} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bidSuccess && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 inset-x-0 flex justify-center z-50">
            <div className="px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2" style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
              <Check className="w-4 h-4" />{isAr ? 'تم تسجيل مزايدتك بنجاح' : 'Your bid was placed'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {submitOpen && (
          <SubmitItemDialog isAr={isAr} dir={dir} brands={brands} onClose={() => setSubmitOpen(false)} onSuccess={handleSubmitSuccess} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {submitSuccess && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 inset-x-0 flex justify-center z-50">
            <div className="px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2" style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
              <Check className="w-4 h-4" />{isAr ? 'وصلنا طلبك! بنتواصل معك قريباً' : "Got it! We'll contact you soon"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
