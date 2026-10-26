/**
 * ProductPage — صفحة منتج مستقلة (/shop/:id و/en/shop/:id) لنتائج جوجل للتسوق.
 * JSON-LD من نوع Product (السعر ر.س + التوفر) — يُولَّد أيضاً مسبقاً وقت البناء (scripts/seo-build.mjs).
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { SarAmount } from '@/components/shared/SarCurrency';
import { Loader2 } from 'lucide-react';

const SITE = 'https://www.needlecobbler.com';
const WA = '966549678191';
const INK = '#ece8df';
const abs = (u) => (!u ? null : /^https?:\/\//.test(u) ? u : SITE + (u.startsWith('/') ? u : '/' + u));

export default function ProductPage() {
  const { id } = useParams();
  const { dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const prefix = isAr ? '' : '/en';

  const { data: p, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: related = [] } = useQuery({
    queryKey: ['product-related', id],
    enabled: !!p,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id,name,name_ar,price,image_url,in_stock,category').gt('price', 0).neq('id', id).order('sort_order').limit(8);
      const rows = data || [];
      return [...rows.filter((r) => r.category === p.category), ...rows.filter((r) => r.category !== p.category)].slice(0, 4);
    },
  });

  const name = p ? (isAr ? p.name_ar || p.name : p.name || p.name_ar) : '';
  const bodyText = p ? (isAr ? p.description : p.description_en || p.description) : '';
  const desc = bodyText || (isAr ? `${name} — من متجر إبرة وخيط الإسكافي` : `${name} — Ebra & Khait Cobbler shop`);
  const url = `${SITE}${prefix}/shop/${id}`;

  const ld = p && {
    '@context': 'https://schema.org', '@type': 'Product', '@id': `${url}#product`, url, name, description: desc,
    ...(p.image_url ? { image: [abs(p.image_url)] } : {}), sku: p.sku || String(p.id), mpn: p.sku || String(p.id),
    brand: { '@type': 'Brand', name: p.brand_name || 'إبرة وخيط الإسكافي' },
    offers: { '@type': 'Offer', url, priceCurrency: 'SAR', price: Number(p.price).toFixed(2), itemCondition: 'https://schema.org/NewCondition',
      availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      priceValidUntil: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
      seller: { '@type': 'Organization', name: 'إبرة وخيط الإسكافي', url: SITE } },
  };

  const order = () => {
    const msg = `${isAr ? 'أبغى أطلب' : 'I would like to order'}:\n• ${name} — ${Number(p.price).toFixed(0)} ر.س\n${url}`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  return (
    <div dir={dir} className="min-h-screen px-4 py-8" style={{ background: '#0b0b0c', color: INK }}>
      {p && (
        <Helmet>
          <title>{`${name} | ${isAr ? 'متجر إبرة وخيط الإسكافي' : 'Ebra & Khait Cobbler Shop'}`}</title>
          <meta name="description" content={desc.slice(0, 300)} />
          <link rel="canonical" href={url} />
          <link rel="alternate" hrefLang="ar" href={`${SITE}/shop/${id}`} />
          <link rel="alternate" hrefLang="en" href={`${SITE}/en/shop/${id}`} />
          <link rel="alternate" hrefLang="x-default" href={`${SITE}/shop/${id}`} />
          <meta property="og:type" content="product" />
          <meta property="og:title" content={name} />
          <meta property="og:url" content={url} />
          {p.image_url && <meta property="og:image" content={abs(p.image_url)} />}
          <meta property="product:price:amount" content={Number(p.price).toFixed(2)} />
          <meta property="product:price:currency" content="SAR" />
          <script type="application/ld+json">{JSON.stringify(ld)}</script>
        </Helmet>
      )}
      <div className="max-w-4xl mx-auto">
        <nav aria-label="breadcrumb" className="text-sm flex flex-wrap gap-2" style={{ color: '#8d8a82' }}>
          <Link to={prefix || '/'} className="underline">{isAr ? 'الرئيسية' : 'Home'}</Link><span>/</span>
          <Link to={`${prefix}/shop`} className="underline">{isAr ? 'المتجر' : 'Shop'}</Link>{p && <><span>/</span><span style={{ color: '#bdb8ad' }}>{name}</span></>}
        </nav>
        {isLoading && <Loader2 className="w-6 h-6 animate-spin mx-auto mt-20" />}
        {!isLoading && !p && <p className="text-center mt-20" style={{ color: '#8d8a82' }}>{isAr ? 'المنتج غير موجود' : 'Product not found'}</p>}
        {p && (
          <div className="mt-6 grid md:grid-cols-2 gap-8">
            <div style={{ aspectRatio: '1 / 1', background: '#131315' }}>
              {p.image_url && <img src={p.image_url} alt={name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex flex-col gap-4">
              {p.brand_name && <span className="text-xs" style={{ color: '#8d8a82' }}>{p.brand_name}</span>}
              <h1 className="text-2xl font-semibold leading-snug">{name}</h1>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold"><SarAmount value={p.price} decimals={0} /></span>
                {p.original_price > p.price && <span className="text-sm line-through" style={{ color: '#8d8a82' }}><SarAmount value={p.original_price} decimals={0} /></span>}
              </div>
              {bodyText && <p className="leading-loose font-light" style={{ color: '#a8a398' }}>{bodyText}</p>}
              {p.sku && <div className="text-xs" style={{ color: '#8d8a82' }}>SKU: {p.sku}</div>}
              <div className="text-sm" style={{ color: p.in_stock ? '#4ade80' : '#8d8a82' }}>{p.in_stock ? (isAr ? 'متوفر' : 'In stock') : (isAr ? 'غير متوفر' : 'Out of stock')}</div>
              <button disabled={!p.in_stock} onClick={order} className="min-h-[52px] font-semibold disabled:opacity-40" style={{ background: INK, color: '#0b0b0c' }}>
                {isAr ? 'اطلب عبر واتساب' : 'Order on WhatsApp'}
              </button>
              <p className="text-xs" style={{ color: '#8d8a82' }}>{isAr ? 'توصيل داخل الرياض — مجاني للطلبات فوق 200 ريال.' : 'Delivery in Riyadh — free above SAR 200.'}</p>
            </div>
          </div>
        )}

        {p && (
          <div className="mt-10 grid sm:grid-cols-3 gap-3 text-sm" style={{ color: '#bdb8ad' }}>
            {[
              [isAr ? 'توصيل داخل الرياض' : 'Delivery in Riyadh', isAr ? 'مجاني للطلبات فوق 200 ريال، و30 ريال دونها.' : 'Free above SAR 200, SAR 30 below.'],
              [isAr ? 'طرق الدفع' : 'Payment', isAr ? 'نقداً، تحويل بنكي، Apple Pay، مدى.' : 'Cash, bank transfer, Apple Pay, Mada.'],
              [isAr ? 'تأكيد الطلب' : 'Order confirmation', isAr ? 'نؤكد الطلب والتوصيل معك عبر واتساب.' : 'We confirm your order and delivery on WhatsApp.'],
            ].map(([t, d]) => (
              <div key={t} className="p-4" style={{ border: '1px solid rgba(255,255,255,0.08)' }}><div className="font-semibold mb-1" style={{ color: INK }}>{t}</div>{d}</div>
            ))}
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold mb-4">{isAr ? 'منتجات أخرى قد تعجبك' : 'You may also like'}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((r) => (
                <Link key={r.id} to={`${prefix}/shop/${r.id}`} className="block" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ aspectRatio: '1 / 1', background: '#131315' }}>{r.image_url && <img src={r.image_url} alt={isAr ? r.name_ar || r.name : r.name || r.name_ar} loading="lazy" className="w-full h-full object-cover" />}</div>
                  <div className="p-3 text-sm"><div className="line-clamp-2">{isAr ? r.name_ar || r.name : r.name || r.name_ar}</div><div className="mt-1 font-bold"><SarAmount value={r.price} decimals={0} /></div></div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
