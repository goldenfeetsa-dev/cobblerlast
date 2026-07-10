import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseApi';
import { motion } from 'framer-motion';
import { ShoppingCart, Plus, Search, ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const GOLD = '#C9A84C';

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

function CartDrawer({ cart, onClose, onRemove }) {
  const { t, dir } = useLanguage();
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <div className="fixed inset-0 z-50 flex justify-start" dir={dir}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: dir === 'rtl' ? '-100%' : '100%' }} animate={{ x: 0 }} exit={{ x: dir === 'rtl' ? '-100%' : '100%' }} transition={{ type: 'spring', damping: 25 }}
        className={`relative w-full max-w-sm h-full flex flex-col overflow-hidden z-10 ${dir === 'ltr' ? 'ml-auto' : ''}`}
        style={{ background: '#1A0C00', borderLeft: '1px solid rgba(201,168,76,0.15)' }}>
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
          <h2 className="text-lg font-black" style={{ color: '#F5EDD8' }}>{t('shop.cart')} ({cart.length})</h2>
          <button onClick={onClose} style={{ color: 'rgba(245,237,216,0.4)' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'rgba(245,237,216,0.3)' }}>{t('shop.cartEmpty')}</p>
          ) : cart.map(item => (
            <div key={item.id} className="flex gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.08)' }}>
              <img src={item.image_url} alt={`${item.name_ar} — ${t('common.brand')}`} className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: '#F5EDD8' }}>{item.name_ar}</p>
                <p className="text-xs mt-1" style={{ color: GOLD }}>{item.price} SAR × {item.qty}</p>
              </div>
              <button onClick={() => onRemove(item.id)} style={{ color: 'rgba(245,237,216,0.3)' }}><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="p-6 border-t space-y-4" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
            <div className="flex justify-between text-base font-black">
              <span style={{ color: '#F5EDD8' }}>{t('shop.total')}</span>
              <span style={{ color: GOLD }}>{total.toFixed(0)} SAR</span>
            </div>
            <button
              onClick={() => {
                const itemsText = cart.map(item =>
                  `• ${item.name_ar} × ${item.qty} = ${(item.price * item.qty).toFixed(0)} SAR`
                ).join('\n');
                const msg = `${t('shop.orderWhatsapp')}:\n\n${itemsText}\n\n💰 ${t('shop.total')}: ${total.toFixed(0)} SAR`;
                window.open(`https://wa.me/966549678191?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-sm text-white hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg, #25D366, #20bb5a)' }}>
              {t('shop.orderWhatsapp')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ProductCard({ product, onAdd, t }) {
  const discount = product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="group rounded-2xl overflow-hidden flex flex-col h-full transition-all duration-300 hover:-translate-y-1"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
      <div className="relative overflow-hidden" style={{ height: '200px' }}>
        <img src={product.image_url || FALLBACK_IMAGES[0]}
          alt={`${product.name_ar} — ${t('common.brand')}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, #120A00 100%)' }} />
        {!product.in_stock && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-900/80 text-red-300">{t('shop.outOfStock')}</span>
          </div>
        )}
        {product.is_featured && product.in_stock && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(201,168,76,0.9)', color: '#1A0C00' }}>
            <Star className="w-3 h-3 inline ml-1" />{t('shop.featured')}
          </div>
        )}
        {discount > 0 && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white">
            -{discount}%
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-black text-base mb-1" style={{ color: '#F5EDD8' }}>{product.name_ar}</h3>
        {product.description && (
          <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: 'rgba(245,237,216,0.4)' }}>
            {product.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto">
          <div>
            <span className="text-lg font-black" style={{ color: GOLD }}>{product.price} SAR</span>
            {product.original_price && (
              <span className="text-xs line-through mr-2" style={{ color: 'rgba(245,237,216,0.3)' }}>{product.original_price}</span>
            )}
          </div>
          {product.in_stock && (
            <button onClick={() => onAdd(product)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-black hover:scale-105 transition-all"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)` }}>
              <Plus className="w-3.5 h-3.5" />{t('shop.add')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Shop() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const BackIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;

  const { data: dbProducts = [] } = useQuery({
    queryKey: ['products-public'],
    queryFn: () => base44.entities.Product.list('-created_at', 200),
  });

  const fallbackProducts = useFallbackProducts(t);
  const CATEGORIES = t('shop.categories');
  const products = dbProducts.length > 0 ? dbProducts : fallbackProducts;

  const filtered = products.filter(p => {
    const catOk = activeCat === 'all' || p.category === activeCat;
    const searchOk = !search || p.name_ar?.includes(search) || p.description?.includes(search);
    return catOk && searchOk;
  });

  const addToCart = (product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
    setCartOpen(true);
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div dir={dir} style={{ background: '#120A00', minHeight: '100vh', fontFamily: "'Tajawal', sans-serif" }}>
      <Helmet>
        <title>{isAr ? 'متجر إبرة وخيط | منتجات العناية بالأحذية والحقائب الفاخرة - الرياض' : "Cobbler's Shop | Shoe & Leather Bag Care Products — Riyadh"}</title>
        <meta name="description" content={isAr
          ? 'تسوق منتجات العناية بالأحذية والحقائب الجلدية الفاخرة والبسطار العسكري — نعال، كريمات تلميع، جلود، وأدوات احترافية. توصيل في الرياض.'
          : 'Shop premium products for caring for shoes, leather bags, sneakers, and military boots — soles, polish creams, leathers, and professional tools. Delivery in Riyadh.'} />
        <meta name="keywords" content={isAr
          ? 'متجر أحذية الرياض, كريم تلميع أحذية, نعال جلدي, صبغة جلد, منتجات العناية بالجلود, فرشاة تلميع أحذية, واقي جلد, ملمع أحذية فاخر, أدوات صيانة الحقائب الجلدية, مستلزمات تصليح بسطار عسكري, shop shoe care riyadh, leather care products riyadh'
          : 'shop shoe care riyadh, leather care products riyadh, shoe polish cream, leather sole, leather dye, shoe care accessories, military boot supplies riyadh'} />
        <link rel="canonical" href="https://cobblerlast.com/shop" />
        <meta property="og:title" content={isAr ? 'متجر إبرة وخيط — منتجات العناية بالأحذية والحقائب' : "Cobbler's Shop — Shoe & Bag Care Products"} />
        <meta property="og:description" content={isAr ? 'منتجات احترافية للعناية بالأحذية والحقائب الجلدية. توصيل في الرياض.' : 'Professional products for shoe and leather bag care. Delivery in Riyadh.'} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cobblerlast.com/shop" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "منتجات إبرة وخيط الإسكافي",
          "url": "https://cobblerlast.com/shop",
          "numberOfItems": filtered.length,
          "itemListElement": filtered.slice(0, 20).map((p, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
              "@type": "Product",
              "@id": `https://cobblerlast.com/shop#product-${p.id}`,
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
                "url": `https://cobblerlast.com/shop#product-${p.id}`,
                "seller": { "@type": "Organization", "name": "إبرة وخيط الإسكافي", "url": "https://cobblerlast.com" },
                "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
              }
            }
          }))
        })}</script>
      </Helmet>
      {/* Navbar */}
      <nav className="sticky top-0 z-40 px-6 h-16 flex items-center justify-between"
        style={{ background: 'rgba(18,10,0,0.95)', borderBottom: '1px solid rgba(201,168,76,0.1)', backdropFilter: 'blur(12px)' }}>
        <Link to="/" className="text-xl font-black" style={{ color: GOLD }}>{t('common.brand')}</Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link to="/book" className="hidden sm:block px-5 h-9 rounded-full text-sm font-bold text-black flex items-center"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)` }}>{t('shop.bookNow')}</Link>
          <button onClick={() => setCartOpen(true)} className="relative p-2 rounded-full"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: GOLD }}>
            <ShoppingCart className="w-5 h-5" />
            {totalQty > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full text-xs font-black flex items-center justify-center text-black"
                style={{ background: GOLD }}>{totalQty}</span>
            )}
          </button>
        </div>
      </nav>

      {/* Header */}
      <div className="py-16 px-6 text-center" style={{ background: 'linear-gradient(180deg, #1A0C00 0%, #120A00 100%)' }}>
        <Link to="/booking" className="inline-flex items-center gap-2 mb-6 text-sm hover:opacity-80 transition-opacity"
          style={{ color: 'rgba(245,237,216,0.4)' }}>
          <BackIcon className="w-4 h-4" />{t('shop.backHome')}
        </Link>
        <h1 className="text-4xl md:text-5xl font-black mb-3" style={{ color: '#F5EDD8' }}>{t('shop.title')}</h1>
        <p className="text-sm max-w-md mx-auto mb-8" style={{ color: 'rgba(245,237,216,0.4)' }}>
          {t('shop.subtitle')}
        </p>
        {/* Search */}
        <div className="relative max-w-sm mx-auto">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(201,168,76,0.5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('shop.searchPh')}
            className="w-full pr-11 pl-4 py-3 rounded-full text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#F5EDD8' }} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-24">
        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setActiveCat(c.key)}
              className="px-4 py-2 rounded-full text-sm font-bold transition-all"
              style={{
                background: activeCat === c.key ? `linear-gradient(135deg, ${GOLD}, #e8c96a)` : 'rgba(255,255,255,0.03)',
                color: activeCat === c.key ? '#1A0C00' : 'rgba(245,237,216,0.5)',
                border: activeCat === c.key ? 'none' : '1px solid rgba(201,168,76,0.1)',
              }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-lg font-bold mb-2" style={{ color: 'rgba(245,237,216,0.3)' }}>{t('shop.noProducts')}</p>
            <p className="text-sm" style={{ color: 'rgba(245,237,216,0.15)' }}>{t('shop.tryDifferent')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} t={t} />)}
          </div>
        )}

        {/* WhatsApp CTA */}
        <div className="mt-16 rounded-2xl p-8 text-center"
          style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(201,168,76,0.1)' }}>
          <p className="text-sm mb-4" style={{ color: 'rgba(245,237,216,0.4)' }}>
            {t('shop.needSomethingElse')}
          </p>
          <a href="https://wa.me/966549678191" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-white hover:scale-105 transition-all"
            style={{ background: 'linear-gradient(135deg, #25D366, #20bb5a)' }}>
            {t('shop.contactWhatsapp')}
          </a>
        </div>
      </div>

      {/* Cart Drawer */}
      {cartOpen && <CartDrawer cart={cart} onClose={() => setCartOpen(false)} onRemove={removeFromCart} />}
    </div>
  );
}
