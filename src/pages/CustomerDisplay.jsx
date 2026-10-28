/**
 * CustomerDisplay — شاشة العميل (/customer-display)
 * تصميم نهاري فاتح بروح موقع الزوّار (خطوط رفيعة، عاجي، ذهبي داكن) وتباين عالٍ يُقرأ تحت الإضاءة القوية.
 * - وضع الانتظار: عرض صور متنوعة (قبل/بعد، الورشة، منتجات المتجر) بحركات انتقال مختلفة.
 * - عند وجود فاتورة: حساب العميل بوضوح + شعارات وسائل الدفع.
 * ?demo=1 يعرض فاتورة تجريبية لاختبار الشاشة.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { subscribeDisplay } from '@/lib/customerDisplay';
import { listShopProductsWithBrand } from '@/api/supabaseApi';
import { SarAmount } from '@/components/shared/SarCurrency';
import PaymentLogos from '@/components/shared/PaymentLogos';

const BG = '#f6f2e9', INK = '#17130f', MUTED = '#5a5247', GOLD = '#7a5a12', HAIR = 'rgba(23,19,15,0.2)';
const LOGO = '/images/cobblers-official-mark.png';
const LINES = ['كل قطعة لها قصة، ونكتب فصلها التالي بأيدٍ سعودية', 'ضمان 30 يوماً على أعمال الترميم', 'تتبّع قطعتك من needlecobbler.com/track', 'تقييم مجاني خلال ساعة واحدة'];
const BASE_SLIDES = [
  { src: '/images/gallery/bag-before.png', title: 'نعيد للحقيبة حياتها', badge: 'قبل الترميم' },
  { src: '/images/gallery/bag-after.png', title: 'نعيد للحقيبة حياتها', badge: 'بعد الترميم', reveal: true },
  { src: '/images/hero-workshop.jpg', title: 'ورشتنا في الرياض', badge: 'حرفة بأيدٍ خبيرة' },
  { src: '/images/gallery/sneaker-before.png', title: 'نرمّم ما ظننته انتهى', badge: 'قبل الترميم' },
  { src: '/images/gallery/sneaker-after.png', title: 'نرمّم ما ظننته انتهى', badge: 'بعد الترميم', reveal: true },
];
// حركات الانتقال بين الصور — تُدوَّر تلقائياً
const FX = ['trFade', 'trSlideL', 'trZoom', 'trCircle', 'trDiag', 'trBlur', 'trRise', 'trFlip', 'trSlideR', 'trWipeD'];
const KEYFRAMES = `
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes trFade{from{opacity:0}to{opacity:1}}
@keyframes trSlideL{from{transform:translateX(-100%)}to{transform:none}}
@keyframes trSlideR{from{transform:translateX(100%)}to{transform:none}}
@keyframes trRise{from{transform:translateY(100%)}to{transform:none}}
@keyframes trZoom{from{opacity:0;transform:scale(1.4)}to{opacity:1;transform:scale(1)}}
@keyframes trCircle{from{clip-path:circle(0% at 50% 50%)}to{clip-path:circle(80% at 50% 50%)}}
@keyframes trDiag{from{clip-path:polygon(0 0,0 0,0 0)}to{clip-path:polygon(0 0,230% 0,0 230%)}}
@keyframes trWipeD{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes trBlur{from{opacity:0;filter:blur(36px)}to{opacity:1;filter:blur(0)}}
@keyframes trFlip{from{opacity:0;transform:perspective(1400px) rotateY(80deg)}to{opacity:1;transform:perspective(1400px) rotateY(0)}}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.1)}}
@keyframes progress{from{width:0}to{width:100%}}
@keyframes up{from{opacity:0;transform:translateY(2vh)}to{opacity:1;transform:none}}
`;
const money = (v) => <SarAmount value={Number(v || 0).toFixed(2)} />;
const DEMO = { mode: 'order', name: 'محمد', lines: [{ label: 'حقيبة — تنظيف عميق' }, { label: 'حقيبة — إعادة صبغ' }, { label: 'حذاء — تغيير نعل' }], subtotal: 260.87, vat: 39.13, total: 300 };

function Idle() {
  const { data: products = [] } = useQuery({ queryKey: ['display-products'], queryFn: () => listShopProductsWithBrand(), staleTime: 600000, retry: 0 });
  const slides = useMemo(() => {
    const extra = (products || []).filter((p) => p.image_url).slice(0, 8).map((p) => ({ src: p.image_url, title: p.name_ar || 'من متجرنا', badge: 'من متجرنا' }));
    // نوزّع صور المتجر بين الصور الثابتة لتنوّع أكبر
    const out = []; const b = [...BASE_SLIDES]; let e = 0;
    b.forEach((s, i) => { out.push(s); if (!(b[i + 1]?.reveal) && extra[e]) out.push(extra[e++]); });
    while (extra[e]) out.push(extra[e++]);
    return out;
  }, [products]);
  const [n, setN] = useState({ cur: 0, prev: -1, fx: 0 });
  const [l, setL] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setN((v) => ({ cur: (v.cur + 1) % slides.length, prev: v.cur, fx: (v.fx + 1) % FX.length })), 5200);
    const c = setInterval(() => setL((v) => (v + 1) % LINES.length), 6000);
    return () => { clearInterval(a); clearInterval(c); };
  }, [slides.length]);
  const cur = slides[n.cur % slides.length], prev = n.prev >= 0 ? slides[n.prev % slides.length] : null;
  const fx = cur.reveal ? 'trWipeD' : FX[n.fx];
  const Img = ({ s, animate }) => (
    <div className="absolute inset-0" style={animate ? { animation: `${fx} 1.5s cubic-bezier(.65,0,.35,1) both` } : undefined}>
      <img src={s.src} alt="" className="w-full h-full object-cover" style={{ animation: 'kb 14s ease-in-out infinite alternate' }} />
    </div>
  );
  return (
    <div className="h-full flex flex-col items-center justify-between py-[3.5vh]" style={{ background: BG, color: INK }}>
      <img src={LOGO} alt="إبرة وخيط الإسكافي" style={{ height: '14vh', width: 'auto' }} />
      <div className="relative" style={{ width: 'min(78vw, 112vh)', height: '52vh' }}>
        <div className="absolute inset-0 overflow-hidden" style={{ border: `1px solid ${HAIR}`, background: '#000', boxShadow: '0 2.4vh 6vh rgba(23,19,15,.25)' }}>
          {prev && <Img key={'p' + n.prev + '-' + n.cur} s={prev} />}
          <Img key={'c' + n.cur + '-' + n.fx} s={cur} animate />
          <div key={'b' + n.cur} className="absolute bottom-[2vh] start-[2vh] px-[2vh] py-[.9vh] font-bold" style={{ background: 'rgba(246,242,233,.92)', color: INK, fontSize: '2.4vh', animation: 'up .8s ease .6s both' }}>{cur.badge}</div>
          <div className="absolute bottom-0 inset-x-0 h-[.6vh]" style={{ background: 'rgba(255,255,255,.25)' }}><div key={'pg' + n.cur} className="h-full" style={{ background: GOLD, animation: 'progress 5.2s linear both' }} /></div>
        </div>
        {[['top-0 start-0', 'borderTop borderInlineStart'], ['top-0 end-0', 'borderTop borderInlineEnd'], ['bottom-0 start-0', 'borderBottom borderInlineStart'], ['bottom-0 end-0', 'borderBottom borderInlineEnd']].map(([pos, b], i) => (
          <span key={i} className={`absolute ${pos}`} style={{ width: '4vh', height: '4vh', margin: '-1.2vh', ...Object.fromEntries(b.split(' ').map((k) => [k, `3px solid ${GOLD}`])) }} />
        ))}
      </div>
      <div className="text-center">
        <p key={'t' + n.cur} className="font-bold" style={{ fontSize: '4.8vh', animation: 'up .9s ease both' }}>{cur.title}</p>
        <p key={'l' + l} className="mt-[.8vh]" style={{ fontSize: '2.8vh', color: MUTED, animation: 'fadeIn 1s ease' }}>{LINES[l]}</p>
      </div>
      <PaymentLogos height="4.6vh" />
    </div>
  );
}

function Bill({ s }) {
  return (
    <div className="h-full flex flex-col mx-auto w-full" style={{ background: BG, color: INK, maxWidth: '100vw' }}>
      <div className="flex flex-col h-full mx-auto w-full px-[6vw] py-[4vh]" style={{ maxWidth: '1200px' }}>
        <div className="flex items-center justify-between pb-[2vh]" style={{ borderBottom: `1px solid ${HAIR}` }}>
          <img src={LOGO} alt="" style={{ height: '11vh', width: 'auto' }} />
          <span style={{ fontSize: '2.6vh', color: GOLD, letterSpacing: '.35em' }}>{s.mode === 'sale' ? 'فاتورة مبيعات' : 'طلب جديد'}</span>
        </div>
        {s.name && <p className="mt-[3vh] font-light" style={{ fontSize: '5vh' }}>أهلاً <span className="font-bold">{s.name}</span></p>}
        <div className="flex-1 overflow-y-auto mt-[2vh]">
          {(s.lines || []).map((ln, k) => (
            <div key={k} className="flex items-baseline justify-between py-[2vh]" style={{ borderBottom: `1px solid ${HAIR}`, animation: 'up .5s ease both', animationDelay: `${Math.min(k, 8) * 60}ms` }}>
              <span style={{ fontSize: '3.6vh', fontWeight: 600 }}>{ln.label}{ln.qty > 1 ? <span style={{ color: MUTED }}> × {ln.qty}</span> : null}</span>
              {ln.amount != null && <span style={{ fontSize: '3.4vh', color: MUTED }}>{money(ln.amount)}</span>}
            </div>
          ))}
        </div>
        {s.total > 0 ? (
          <div className="pt-[2vh]">
            <div className="flex justify-between" style={{ fontSize: '2.6vh', color: MUTED }}><span>قبل الضريبة</span><span>{money(s.subtotal)}</span></div>
            <div className="flex justify-between mt-[.6vh]" style={{ fontSize: '2.6vh', color: MUTED }}><span>ضريبة القيمة المضافة 15%</span><span>{money(s.vat)}</span></div>
            <div className="flex justify-between items-baseline mt-[1.4vh] pt-[1.6vh]" style={{ borderTop: `2px solid ${GOLD}` }}>
              <span style={{ fontSize: '3.6vh', color: GOLD, fontWeight: 700 }}>الإجمالي</span>
              <span className="font-light" style={{ fontSize: '11vh', lineHeight: 1.05 }}>{money(s.total)}</span>
            </div>
          </div>
        ) : (
          <p className="pt-[2vh] text-center font-bold" style={{ fontSize: '4vh', color: GOLD, borderTop: `2px solid ${GOLD}` }}>السعر يُحدَّد بعد التقييم المجاني</p>
        )}
        <div className="pt-[2.4vh]"><PaymentLogos height="5.2vh" /></div>
      </div>
    </div>
  );
}

export default function CustomerDisplay() {
  const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
  const [state, setState] = useState(demo ? DEMO : null);
  useEffect(() => subscribeDisplay(setState), []);
  // لو توقف النبض (إغلاق صفحة الكاشير) نرجع للعرض بعد 45 ثانية؛ الكاشير يرسل نبضاً كل 10 ثوانٍ طالما الفاتورة مفتوحة
  useEffect(() => { if (!state || demo) return; const t = setTimeout(() => setState(null), 45000); return () => clearTimeout(t); }, [state, demo]);
  const active = state && (state.total > 0 || (state.lines || []).length);
  return (
    <div dir="rtl" className="fixed inset-0" style={{ cursor: 'none' }}>
      <Helmet><title>إبرة وخيط الإسكافي</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <style>{KEYFRAMES}</style>
      {active ? <Bill s={state} /> : <Idle />}
    </div>
  );
}
