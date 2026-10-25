import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listShopProductsWithBrand } from '@/api/supabaseApi';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, X, Plus, Minus, Check, ArrowRight, ArrowLeft, Truck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { pageSeo } from '@/lib/seo/siteData';
import { SarAmount, RiyalText } from '@/components/shared/SarCurrency';

const WA_NUMBER = '966549678191';
const INK = '#ece8df';
const HAIR = 'rgba(255,255,255,0.08)';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
  'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80',
  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80',
  'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400&q=80',
  'https://images.unsplash.com/photo-1558171813-05e6cbb28a77?w=400&q=80',
  'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'https://images.unsplash.com/photo-1558171813-05e6cbb28a77?w=400&q=80',
  'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&q=80',
  'https://images.unsplash.com/photo-1558171813-05e6cbb28a77?w=400&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
  'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400&q=80',
];
const FALLBACK_META = [
  { category: 'soles', price: 85, original_price: 120, in_stock: true, is_featured: true },
  { category: 'soles', price: 45, in_stock: true },
  { category: 'leather', price: 220, in_stock: true, is_featured: true },
  { category: 'care', price: 65, original_price: 90, in_stock: true, is_featured: true },
  { category: 'threads', price: 35, in_stock: true },
  { category: 'tools', price: 120, in_stock: true },
  { category: 'adhesives', price: 55, in_stock: true },
  { category: 'zippers', price: 40, in_stock: false },
  { category: 'care', price: 95, in_stock: true, is_featured: true },
  { category: 'threads', price: 28, in_stock: true },
  { category: 'soles', price: 60, in_stock: true },
  { category: 'care', price: 75, in_stock: true },
];

function useFallbackProducts(t) {
  const names = t('shop.products');
  return names.map((p, i) => ({
    id: String(i + 1),
    name_ar: p.name,
    description: p.description,
    image_url: FALLBACK_IMAGES[i],
    ...FALLBACK_META[i],
  }));
}


function WhatsAppGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

const discountOf = (p) => (p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0);

function Price({ product, size = 'text-base' }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className={`${size} font-bold`} style={{ color: INK }}><SarAmount value={product.price} decimals={0} /></span>
      {product.original_price > product.price && (
        <span className="text-xs line-through" style={{ color: '#8d8a82' }}><SarAmount value={product.original_price} decimals={0} /></span>
      )}
    </div>
  );
}

function ProductCard({ product, onOpen, onAdd, justAdded, t }) {
  const d = discountOf(product);
  return (
    <article className="shop-card group flex flex-col">
      <button onClick={() => onOpen(product)} className="relative block w-full overflow-hidden text-start" style={{ aspectRatio: '1 / 1', background: '#131315' }} aria-label={product.name_ar}>
        <img src={product.image_url || FALLBACK_IMAGES[0]} alt={`${product.name_ar} — ${t('common.brand')}`} loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" style={{ opacity: product.in_stock ? 1 : 0.45 }} />
        <div className="absolute top-2.5 start-2.5 flex flex-col gap-1.5 items-start">
          {d > 0 && <span className="px-2 py-1 text-[11px] font-bold" style={{ background: INK, color: '#0b0b0c' }}>-{d}%</span>}
          {product.is_featured && product.in_stock && <span className="px-2 py-1 text-[11px] font-semibold" style={{ border: '1px solid rgba(255,255,255,.3)', color: INK, background: 'rgba(11,11,12,.6)' }}>{t('shop.featured')}</span>}
        </div>
        {!product.in_stock && <span className="absolute bottom-2.5 start-2.5 px-2 py-1 text-[11px] font-semibold" style={{ background: 'rgba(11,11,12,.85)', color: '#bdb8ad' }}>{t('shop.outOfStock')}</span>}
      </button>
      <div className="pt-3.5 flex flex-col flex-1 gap-1.5">
        {product.brand && <span className="text-[11px] tracking-wide" style={{ color: '#8d8a82' }}>{product.brand.name_ar || product.brand.name}</span>}
        <h3 className="text-[15px] font-semibold leading-snug line-clamp-2" style={{ color: INK }}>{product.name_ar}</h3>
        <div className="mt-auto pt-1"><Price product={product} /></div>
        <button disabled={!product.in_stock} onClick={() => onAdd(product)}
          className="shop-add mt-2.5 min-h-[44px] w-full flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed">
          {justAdded ? <><Check className="w-4 h-4" />{t('common.lang') === 'en' ? 'Added' : 'تمت الإضافة'}</> : <><Plus className="w-4 h-4" />{t('shop.add')} {t('common.lang') === 'en' ? 'to cart' : 'للسلة'}</>}
        </button>
      </div>
    </article>
  );
}

function QtyStepper({ qty, onChange }) {
  return (
    <div className="inline-flex items-center" style={{ border: `1px solid ${HAIR}` }}>
      <button onClick={() => onChange(qty - 1)} className="w-9 h-9 flex items-center justify-center hover:bg-white/10" aria-label="-"><Minus className="w-3.5 h-3.5" /></button>
      <span className="w-9 text-center text-sm font-semibold" style={{ color: INK }}>{qty}</span>
      <button onClick={() => onChange(qty + 1)} className="w-9 h-9 flex items-center justify-center hover:bg-white/10" aria-label="+"><Plus className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function Sheet({ children, onClose, side = 'bottom', dir }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
  const isSide = side === 'side';
  const from = isSide ? { x: dir === 'rtl' ? '-100%' : '100%' } : { y: '100%' };
  return (
    <div className={`fixed inset-0 z-50 ${isSide ? '' : 'flex items-end md:items-center justify-center'}`} dir={dir}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div initial={from} animate={{ x: 0, y: 0 }} exit={from} transition={{ type: 'tween', duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={isSide ? 'absolute top-0 bottom-0 w-full max-w-md flex flex-col' : 'relative w-full md:w-[860px] max-h-[92svh] flex flex-col'}
        style={{ background: '#0b0b0c', border: `1px solid ${HAIR}`, ...(isSide ? { [dir === 'rtl' ? 'left' : 'right']: 0 } : {}) }}>
        {children}
      </motion.div>
    </div>
  );
}

function ProductSheet({ product, onClose, onAdd, t, dir, isAr }) {
  const [qty, setQty] = useState(1);
  const d = discountOf(product);
  return (
    <Sheet onClose={onClose} dir={dir}>
      <button onClick={onClose} className="absolute top-3 end-3 z-10 w-10 h-10 flex items-center justify-center" style={{ background: 'rgba(11,11,12,.8)', border: `1px solid ${HAIR}`, color: INK }} aria-label="close"><X className="w-4 h-4" /></button>
      <div className="overflow-y-auto md:grid md:grid-cols-2">
        <div className="relative" style={{ aspectRatio: '1 / 1', background: '#131315' }}>
          <img src={product.image_url || FALLBACK_IMAGES[0]} alt={product.name_ar} className="w-full h-full object-cover" />
          {d > 0 && <span className="absolute top-3 start-3 px-2.5 py-1 text-xs font-bold" style={{ background: INK, color: '#0b0b0c' }}>-{d}%</span>}
        </div>
        <div className="p-6 md:p-8 flex flex-col gap-4">
          {product.brand && <span className="text-xs tracking-wide" style={{ color: '#8d8a82' }}>{product.brand.name_ar || product.brand.name}</span>}
          <h2 className="text-2xl font-semibold leading-snug" style={{ color: INK }}>{product.name_ar}</h2>
          <Price product={product} size="text-2xl" />
          {product.description && <p className="text-[15px] leading-loose font-light" style={{ color: '#a8a398' }}>{product.description}</p>}
          <div className="flex items-center gap-2 text-sm" style={{ color: product.in_stock ? '#bdb8ad' : '#8d8a82' }}>
            <span className="w-2 h-2 inline-block" style={{ background: product.in_stock ? '#4ade80' : '#6b7280' }} />
            {product.in_stock ? (isAr ? 'متوفر' : 'In stock') : t('shop.outOfStock')}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <QtyStepper qty={qty} onChange={(n) => setQty(Math.max(1, Math.min(20, n)))} />
            <button disabled={!product.in_stock} onClick={() => { onAdd(product, qty); onClose(); }}
              className="shop-add-solid flex-1 min-h-[48px] flex items-center justify-center gap-2 font-semibold disabled:opacity-35">
              <ShoppingBag className="w-4 h-4" />{isAr ? 'أضف للسلة' : 'Add to cart'}
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function CartSheet({ cart, onClose, onQty, onRemove, t, dir, isAr }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const FREE_FROM = 200;
  const remaining = Math.max(0, FREE_FROM - total);
  const send = () => {
    const lines = cart.map((i) => `• ${i.name_ar} × ${i.qty} = ${(i.price * i.qty).toFixed(0)} ر.س`).join('\n');
    const msg = `${t('shop.orderWhatsapp')}:\n\n${lines}\n\n${t('shop.total')}: ${total.toFixed(0)} ر.س`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };
  return (
    <Sheet onClose={onClose} side="side" dir={dir}>
      <div className="px-6 h-16 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <h2 className="text-lg font-semibold" style={{ color: INK }}>{t('shop.cart')} <span style={{ color: '#8d8a82' }}>({cart.reduce((s, i) => s + i.qty, 0)})</span></h2>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white/10" style={{ color: INK }} aria-label="close"><X className="w-5 h-5" /></button>
      </div>
      {cart.length > 0 && (
        <div className="px-6 py-3 text-xs shrink-0" style={{ borderBottom: `1px solid ${HAIR}`, color: '#bdb8ad' }}>
          <div className="flex items-center gap-2 mb-2"><Truck className="w-3.5 h-3.5" />
            {remaining > 0
              ? <span>{isAr ? 'أضف ' : 'Add '}<SarAmount value={remaining} decimals={0} />{isAr ? ' للحصول على توصيل مجاني داخل الرياض' : ' more for free delivery in Riyadh'}</span>
              : <span>{isAr ? 'توصيل مجاني داخل الرياض' : 'Free delivery in Riyadh'}</span>}
          </div>
          <div className="h-[3px]" style={{ background: 'rgba(255,255,255,.1)' }}><div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, (total / FREE_FROM) * 100)}%`, background: INK }} /></div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
            <ShoppingBag className="w-10 h-10" style={{ color: '#4a4a4e' }} />
            <p className="text-sm" style={{ color: '#8d8a82' }}>{t('shop.cartEmpty')}</p>
            <button onClick={onClose} className="shop-add mt-2 px-8 min-h-[44px] text-sm font-semibold">{isAr ? 'تصفّح المنتجات' : 'Browse products'}</button>
          </div>
        ) : cart.map((item) => (
          <div key={item.id} className="flex gap-4 px-6 py-5" style={{ borderBottom: `1px solid ${HAIR}` }}>
            <img src={item.image_url || FALLBACK_IMAGES[0]} alt={item.name_ar} className="w-20 h-20 object-cover shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex justify-between gap-3">
                <p className="text-sm font-semibold leading-snug" style={{ color: INK }}>{item.name_ar}</p>
                <button onClick={() => onRemove(item.id)} className="shrink-0 hover:opacity-70" style={{ color: '#8d8a82' }} aria-label="remove"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <QtyStepper qty={item.qty} onChange={(n) => onQty(item.id, n)} />
                <span className="text-sm font-bold" style={{ color: INK }}><SarAmount value={item.price * item.qty} decimals={0} /></span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {cart.length > 0 && (
        <div className="p-6 shrink-0 flex flex-col gap-4" style={{ borderTop: `1px solid ${HAIR}` }}>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: '#bdb8ad' }}>{t('shop.total')}</span>
            <span className="text-xl font-bold" style={{ color: INK }}><SarAmount value={total} decimals={0} /></span>
          </div>
          <button onClick={send} className="shop-add-solid min-h-[52px] flex items-center justify-center gap-2.5 font-semibold">
            <WhatsAppGlyph className="w-5 h-5" />{t('shop.orderWhatsapp')}
          </button>
          <p className="text-[11px] text-center" style={{ color: '#8d8a82' }}>{isAr ? 'سنؤكد الطلب والتوصيل معك عبر واتساب' : 'We confirm your order and delivery on WhatsApp'}</p>
        </div>
      )}
    </Sheet>
  );
}

export default function Shop() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [openProduct, setOpenProduct] = useState(null);
  const [added, setAdded] = useState(null);
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const { data: dbProducts = [] } = useQuery({ queryKey: ['products-public-with-brand'], queryFn: () => listShopProductsWithBrand() });
  const fallbackProducts = useFallbackProducts(t);
  const CATEGORIES = t('shop.categories');
  const products = dbProducts.length > 0 ? dbProducts : fallbackProducts;

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const catOk = activeCat === 'all' || p.category === activeCat;
      const q = search.trim();
      return catOk && (!q || p.name_ar?.includes(q) || p.description?.includes(q));
    });
    if (sort === 'asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'desc') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, activeCat, search, sort]);

  const addToCart = (product, qty = 1) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id);
      if (ex) return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { ...product, qty }];
    });
    setAdded(product.id);
    setTimeout(() => setAdded((a) => (a === product.id ? null : a)), 1400);
  };
  const setQty = (id, n) => setCart((prev) => (n <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty: Math.min(20, n) } : i))));
  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div dir={dir} style={{ background: '#0b0b0c', minHeight: '100svh' }}>
      <Helmet>
        <title>{pageSeo('/shop', isAr).title}</title>
        <meta name="description" content={pageSeo('/shop', isAr).description} />
        <meta name="keywords" content={isAr
          ? 'متجر أحذية الرياض, كريم تلميع أحذية, نعال جلدي, صبغة جلد, منتجات العناية بالجلود, فرشاة تلميع أحذية, واقي جلد, ملمع أحذية فاخر, أدوات صيانة الحقائب الجلدية, مستلزمات تصليح بسطار عسكري, shop shoe care riyadh, leather care products riyadh'
          : 'shop shoe care riyadh, leather care products riyadh, shoe polish cream, leather sole, leather dye, shoe care accessories, military boot supplies riyadh'} />
        <link rel="canonical" href="https://www.needlecobbler.com/shop" />
        <meta property="og:title" content={isAr ? 'متجر إبرة وخيط — منتجات العناية بالأحذية والحقائب' : "Cobbler's Shop — Shoe & Bag Care Products"} />
        <meta property="og:description" content={isAr ? 'منتجات احترافية للعناية بالأحذية والحقائب الجلدية. توصيل في الرياض.' : 'Professional products for shoe and leather bag care. Delivery in Riyadh.'} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.needlecobbler.com/shop" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "منتجات إبرة وخيط الإسكافي",
          "url": "https://www.needlecobbler.com/shop",
          "numberOfItems": filtered.length,
          "itemListElement": filtered.slice(0, 20).map((p, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
              "@type": "Product",
              "@id": `https://www.needlecobbler.com/shop#product-${p.id}`,
              "name": p.name_ar || p.name,
              "description": p.description || p.name_ar,
              "image": p.image_url,
              "sku": p.sku || String(p.id),
              "brand": { "@type": "Brand", "name": "إبرة وخيط الإسكافي" },
              "offers": {
                "@type": "Offer",
                "price": p.price,
                "priceCurrency": "SAR",
                "availability": p.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "url": `https://www.needlecobbler.com/shop#product-${p.id}`,
                "seller": { "@type": "Organization", "name": "إبرة وخيط الإسكافي", "url": "https://www.needlecobbler.com" },
                "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
              }
            }
          }))
        })}</script>
      </Helmet>

      {/* شريط إعلان */}
      <div className="text-center text-xs py-2.5 px-4" style={{ background: INK, color: '#0b0b0c' }}>
        <RiyalText text={isAr ? 'توصيل مجاني داخل الرياض للطلبات فوق 200 ر.س' : 'Free delivery in Riyadh on orders over 200 SAR'} />
      </div>

      {/* الهيدر */}
      <header className="sticky top-0 z-40" style={{ background: 'rgba(11,11,12,.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${HAIR}` }}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 grid grid-cols-3 items-center">
          <div className="flex items-center gap-1 justify-self-start">
            <Link to="/" className="flex items-center gap-1.5 text-sm hover:opacity-80" style={{ color: '#bdb8ad' }}><Back className="w-4 h-4" /><span className="hidden sm:inline">{isAr ? 'الموقع' : 'Site'}</span></Link>
          </div>
          <Link to="/shop" className="justify-self-center" aria-label={t('shop.title')}><img src="/images/cobblers-official-mark-white.png" alt={t('common.brand')} className="h-9 w-auto" /></Link>
          <div className="flex items-center gap-2 justify-self-end">
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <button onClick={() => setCartOpen(true)} className="relative w-11 h-11 flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: INK, border: `1px solid ${HAIR}` }} aria-label={t('shop.cart')}>
              <ShoppingBag className="w-5 h-5" />
              {totalQty > 0 && <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1 text-[11px] font-bold flex items-center justify-center" style={{ background: INK, color: '#0b0b0c' }}>{totalQty}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pb-28">
        {/* العنوان + البحث */}
        <div className="pt-10 pb-6">
          <h1 className="text-3xl md:text-4xl font-semibold" style={{ color: INK }}>{t('shop.title')}</h1>
          <p className="mt-2 text-sm font-light" style={{ color: '#a8a398' }}>{t('shop.subtitle')}</p>
          <div className="relative mt-6 max-w-xl">
            <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4" style={{ color: '#8d8a82' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('shop.searchPh')} aria-label={t('shop.searchPh')}
              className="shop-input w-full h-12 ps-11 pe-4 text-sm outline-none" />
          </div>
        </div>

        {/* التصنيفات */}
        <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2 w-max md:w-auto md:flex-wrap pb-1">
            {CATEGORIES.map((c) => (
              <button key={c.key} onClick={() => setActiveCat(c.key)}
                className="shop-chip h-10 px-5 text-sm font-semibold whitespace-nowrap" data-active={activeCat === c.key}>{c.label}</button>
            ))}
          </div>
        </div>

        {/* شريط الفرز */}
        <div className="flex items-center justify-between py-5 mt-2" style={{ borderBottom: `1px solid ${HAIR}` }}>
          <span className="text-sm" style={{ color: '#8d8a82' }}>{filtered.length} {isAr ? 'منتج' : 'products'}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="shop-select h-10 px-3 text-sm outline-none" aria-label={isAr ? 'ترتيب' : 'Sort'}>
            <option value="default">{isAr ? 'الترتيب الافتراضي' : 'Default'}</option>
            <option value="asc">{isAr ? 'السعر: الأقل أولاً' : 'Price: low to high'}</option>
            <option value="desc">{isAr ? 'السعر: الأعلى أولاً' : 'Price: high to low'}</option>
          </select>
        </div>

        {/* المنتجات */}
        {filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-lg font-semibold" style={{ color: '#a8a398' }}>{t('shop.noProducts')}</p>
            <p className="text-sm mt-1" style={{ color: '#8d8a82' }}>{t('shop.tryDifferent')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-9 md:gap-x-5 mt-8">
            {filtered.map((p) => <ProductCard key={p.id} product={p} onOpen={setOpenProduct} onAdd={(x) => addToCart(x, 1)} justAdded={added === p.id} t={t} />)}
          </div>
        )}

        {/* واتساب */}
        <div className="mt-20 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5" style={{ border: `1px solid ${HAIR}`, background: '#0f0f10' }}>
          <p className="text-sm" style={{ color: '#bdb8ad' }}>{t('shop.needSomethingElse')}</p>
          <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer" className="shop-add-solid min-h-[48px] px-8 inline-flex items-center justify-center gap-2.5 font-semibold text-sm">
            <WhatsAppGlyph className="w-5 h-5" />{t('shop.contactWhatsapp')}
          </a>
        </div>
      </main>

      <footer className="px-6 py-10" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
          <img src="/images/cobblers-official-mark-white.png" alt={t('common.brand')} className="h-10 w-auto" />
          <nav className="flex flex-wrap gap-x-7 gap-y-2 text-sm" style={{ color: '#a8a398' }}>
            <Link to="/" className="hover:text-white">{isAr ? 'الرئيسية' : 'Home'}</Link>
            <Link to="/book" className="hover:text-white">{t('shop.bookNow')}</Link>
            <Link to="/shipping-policy" className="hover:text-white">{t('common.footer.shipping')}</Link>
            <Link to="/repair-policy" className="hover:text-white">{t('common.footer.repairPolicy')}</Link>
          </nav>
          <p className="text-xs" style={{ color: '#8d8a82' }}>© {new Date().getFullYear()} {t('common.brand')}</p>
        </div>
      </footer>

      {/* شريط السلة السفلي (جوال) */}
      <AnimatePresence>
        {totalQty > 0 && !cartOpen && !openProduct && (
          <motion.button initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ duration: 0.3 }}
            onClick={() => setCartOpen(true)} className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 px-5 flex items-center justify-between font-semibold"
            style={{ background: INK, color: '#0b0b0c' }}>
            <span className="flex items-center gap-2"><ShoppingBag className="w-5 h-5" />{isAr ? 'عرض السلة' : 'View cart'} ({totalQty})</span>
            <SarAmount value={total} decimals={0} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>{openProduct && <ProductSheet key="p" product={openProduct} onClose={() => setOpenProduct(null)} onAdd={addToCart} t={t} dir={dir} isAr={isAr} />}</AnimatePresence>
      <AnimatePresence>{cartOpen && <CartSheet key="c" cart={cart} onClose={() => setCartOpen(false)} onQty={setQty} onRemove={removeFromCart} t={t} dir={dir} isAr={isAr} />}</AnimatePresence>
    </div>
  );
}
