import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ShoppingCart, Plus, Search, ChevronLeft, Star, X } from 'lucide-react';

const GOLD = '#C9A84C';

const CATEGORIES = [
  { key: 'all', label: 'الكل' },
  { key: 'soles', label: 'نعال وأكواع' },
  { key: 'leather', label: 'جلود فاخرة' },
  { key: 'threads', label: 'خيوط وإبر' },
  { key: 'zippers', label: 'سحّابات' },
  { key: 'care', label: 'مواد العناية' },
  { key: 'tools', label: 'أدوات الورشة' },
  { key: 'adhesives', label: 'مواد اللصق' },
];

const FALLBACK_PRODUCTS = [
  { id: '1', name_ar: 'نعل جلدي إيطالي', category: 'soles', price: 85, original_price: 120, in_stock: true, is_featured: true, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', description: 'نعل جلد طبيعي إيطالي عالي الجودة متوافق مع معظم الأحذية الفاخرة' },
  { id: '2', name_ar: 'كعب أحذية سيدات', category: 'soles', price: 45, in_stock: true, image_url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80', description: 'كعب احترافي متين لأحذية السيدات، متوفر بأحجام متعددة' },
  { id: '3', name_ar: 'جلد عجل فاخر', category: 'leather', price: 220, in_stock: true, is_featured: true, image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80', description: 'جلد عجل طبيعي فاخر، مثالي لترميم الحقائب والأحذية الراقية' },
  { id: '4', name_ar: 'كريم تلميع ذهبي', category: 'care', price: 65, original_price: 90, in_stock: true, is_featured: true, image_url: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400&q=80', description: 'كريم تلميع فاخر من أصل أوروبي يُعيد اللمعة للجلد' },
  { id: '5', name_ar: 'خيط جلدي شمع', category: 'threads', price: 35, in_stock: true, image_url: 'https://images.unsplash.com/photo-1558171813-05e6cbb28a77?w=400&q=80', description: 'خيط جلدي مُشمَّع بقوة شد عالية، مثالي للخياطة اليدوية' },
  { id: '6', name_ar: 'أداة خياطة يدوية', category: 'tools', price: 120, in_stock: true, image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&q=80', description: 'أداة خياطة يدوية احترافية من الفولاذ المقاوم للصدأ' },
  { id: '7', name_ar: 'غراء جلد احترافي', category: 'adhesives', price: 55, in_stock: true, image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', description: 'غراء قوي مخصص للجلود، يُستخدم في ورش الإصلاح الاحترافية' },
  { id: '8', name_ar: 'سحّاب YKK ياباني', category: 'zippers', price: 40, in_stock: false, image_url: 'https://images.unsplash.com/photo-1558171813-05e6cbb28a77?w=400&q=80', description: 'سحّاب YKK الياباني الأصلي، الأكثر متانة في السوق' },
  { id: '9', name_ar: 'صبغة جلد أوروبية', category: 'care', price: 95, in_stock: true, is_featured: true, image_url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&q=80', description: 'صبغة جلد فاخرة مستوردة من إيطاليا، ألوان ثابتة وعميقة' },
  { id: '10', name_ar: 'إبرة ثلاثية الوجه', category: 'threads', price: 28, in_stock: true, image_url: 'https://images.unsplash.com/photo-1558171813-05e6cbb28a77?w=400&q=80', description: 'إبرة ثلاثية الوجه مخصصة لخياطة الجلود السميكة' },
  { id: '11', name_ar: 'نعل مطاط مقاوم', category: 'soles', price: 60, in_stock: true, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', description: 'نعل مطاطي عالي الجودة مقاوم للانزلاق والتآكل' },
  { id: '12', name_ar: 'منظف جلد طبيعي', category: 'care', price: 75, in_stock: true, image_url: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400&q=80', description: 'منظف طبيعي لطيف يزيل البقع ويرطب الجلد في آنٍ واحد' },
];

function CartDrawer({ cart, onClose, onRemove }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25 }}
        className="relative w-full max-w-sm h-full flex flex-col overflow-hidden z-10"
        style={{ background: '#1A0C00', borderLeft: '1px solid rgba(201,168,76,0.15)' }}>
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
          <h2 className="text-lg font-black" style={{ color: '#F5EDD8' }}>سلة التسوق ({cart.length})</h2>
          <button onClick={onClose} style={{ color: 'rgba(245,237,216,0.4)' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'rgba(245,237,216,0.3)' }}>السلة فارغة</p>
          ) : cart.map(item => (
            <div key={item.id} className="flex gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.08)' }}>
              <img src={item.image_url} alt={item.name_ar} className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: '#F5EDD8' }}>{item.name_ar}</p>
                <p className="text-xs mt-1" style={{ color: GOLD }}>{item.price} ر.س × {item.qty}</p>
              </div>
              <button onClick={() => onRemove(item.id)} style={{ color: 'rgba(245,237,216,0.3)' }}><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="p-6 border-t space-y-4" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
            <div className="flex justify-between text-base font-black">
              <span style={{ color: '#F5EDD8' }}>الإجمالي</span>
              <span style={{ color: GOLD }}>{total.toFixed(0)} ر.س</span>
            </div>
            <button
              onClick={() => {
                const itemsText = cart.map(item =>
                  `• ${item.name_ar} × ${item.qty} = ${(item.price * item.qty).toFixed(0)} ر.س`
                ).join('\n');
                const msg = `السلام عليكم، أريد طلب المنتجات التالية:\n\n${itemsText}\n\n💰 الإجمالي: ${total.toFixed(0)} ر.س\n\nأرجو التأكيد والتواصل معي. شكراً 🙏`;
                window.open(`https://wa.me/966549678191?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-sm text-white hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg, #25D366, #20bb5a)' }}>
              اطلب عبر واتساب
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  const discount = product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="group rounded-2xl overflow-hidden flex flex-col h-full transition-all duration-300 hover:-translate-y-1"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
      <div className="relative overflow-hidden" style={{ height: '200px' }}>
        <img src={product.image_url || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80'}
          alt={product.name_ar} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, #120A00 100%)' }} />
        {!product.in_stock && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-900/80 text-red-300">نفذت الكمية</span>
          </div>
        )}
        {product.is_featured && product.in_stock && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(201,168,76,0.9)', color: '#1A0C00' }}>
            <Star className="w-3 h-3 inline ml-1" />مميز
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
            <span className="text-lg font-black" style={{ color: GOLD }}>{product.price} ر.س</span>
            {product.original_price && (
              <span className="text-xs line-through mr-2" style={{ color: 'rgba(245,237,216,0.3)' }}>{product.original_price}</span>
            )}
          </div>
          {product.in_stock && (
            <button onClick={() => onAdd(product)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-black hover:scale-105 transition-all"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)` }}>
              <Plus className="w-3.5 h-3.5" />أضف
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Shop() {
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const { data: dbProducts = [] } = useQuery({
    queryKey: ['products-public'],
    queryFn: () => base44.entities.Product.filter({ in_stock: true }, 'sort_order'),
  });

  const products = dbProducts.length > 0 ? dbProducts : FALLBACK_PRODUCTS;

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
    <div dir="rtl" style={{ background: '#120A00', minHeight: '100vh', fontFamily: "'Tajawal', sans-serif" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-40 px-6 h-16 flex items-center justify-between"
        style={{ background: 'rgba(18,10,0,0.95)', borderBottom: '1px solid rgba(201,168,76,0.1)', backdropFilter: 'blur(12px)' }}>
        <Link to="/booking" className="text-xl font-black" style={{ color: GOLD }}>إبرة وخيط الإسكافي</Link>
        <div className="flex items-center gap-3">
          <Link to="/book" className="hidden sm:block px-5 h-9 rounded-full text-sm font-bold text-black"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)` }}>احجز موعد</Link>
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
          <ChevronLeft className="w-4 h-4" />العودة للرئيسية
        </Link>
        <h1 className="text-4xl md:text-5xl font-black mb-3" style={{ color: '#F5EDD8' }}>متجر الإسكافي</h1>
        <p className="text-sm max-w-md mx-auto mb-8" style={{ color: 'rgba(245,237,216,0.4)' }}>
          مستلزمات وأدوات إصلاح الأحذية والحقائب الفاخرة
        </p>
        {/* Search */}
        <div className="relative max-w-sm mx-auto">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(201,168,76,0.5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث عن منتج..."
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
            <p className="text-lg font-bold mb-2" style={{ color: 'rgba(245,237,216,0.3)' }}>لا توجد منتجات</p>
            <p className="text-sm" style={{ color: 'rgba(245,237,216,0.15)' }}>جرّب تغيير الفئة أو كلمة البحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
          </div>
        )}

        {/* WhatsApp CTA */}
        <div className="mt-16 rounded-2xl p-8 text-center"
          style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(201,168,76,0.1)' }}>
          <p className="text-sm mb-4" style={{ color: 'rgba(245,237,216,0.4)' }}>
            تحتاج منتجاً غير موجود في القائمة؟ تواصل معنا مباشرة
          </p>
          <a href="https://wa.me/966549678191" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-white hover:scale-105 transition-all"
            style={{ background: 'linear-gradient(135deg, #25D366, #20bb5a)' }}>
            تواصل عبر واتساب
          </a>
        </div>
      </div>

      {/* Cart Drawer */}
      {cartOpen && <CartDrawer cart={cart} onClose={() => setCartOpen(false)} onRemove={removeFromCart} />}
    </div>
  );
}