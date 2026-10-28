/**
 * CustomerDisplay — شاشة العميل (/customer-display)
 * تُفتح من الكاشير في الشاشة الثانية (F11 للملء). وضع الانتظار: الشعار بالوسط مع «قبل وبعد» وأسماء البراندات.
 * عند وجود فاتورة: يظهر حساب العميل بوضوح وإجمالي كبير. عند إلغائها أو مغادرة الصفحة: يعود للعرض الفاخر.
 */
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { subscribeDisplay } from '@/lib/customerDisplay';
import { SarAmount } from '@/components/shared/SarCurrency';

const INK = '#ece8df', GOLD = '#c9a84c', HAIR = 'rgba(255,255,255,0.12)', MUTED = '#8d8a82';
const SLIDES = [
  { before: '/images/gallery/bag-before.png', after: '/images/gallery/bag-after.png', t: 'نعيد للحقيبة حياتها' },
  { before: '/images/gallery/sneaker-before.png', after: '/images/gallery/sneaker-after.png', t: 'نرمّم ما ظننته انتهى' },
];
const LINES = ['كل قطعة لها قصة، ونكتب فصلها التالي بأيدٍ سعودية', 'ضمان 30 يوماً على كل عمل', 'تتبّع قطعتك من needlecobbler.com/track'];

function Idle() {
  const [i, setI] = useState(0), [after, setAfter] = useState(false), [l, setL] = useState(0);
  useEffect(() => { const a = setInterval(() => setAfter((v) => !v), 3500); const b = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 9000); const c = setInterval(() => setL((v) => (v + 1) % LINES.length), 6000); return () => { clearInterval(a); clearInterval(b); clearInterval(c); }; }, []);
  const s = SLIDES[i];
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-10">
      <img src="/images/cobblers-official-mark-white.png" alt="إبرة وخيط الإسكافي" className="logo-glow" style={{ height: '22vh', width: 'auto' }} />
      <p className="mt-[3vh] tracking-[0.5em] text-xs" style={{ color: GOLD }}>EBRA & KHAIT COBBLER</p>
      <div className="relative mt-[3vh] overflow-hidden" style={{ height: '32vh', aspectRatio: '4 / 3', border: `1px solid ${HAIR}` }}>
        {[s.before, s.after].map((src, k) => (
          <img key={src} src={src} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: (k === 1) === after ? 1 : 0, transition: 'opacity 1.4s ease' }} />
        ))}
        <span className="absolute bottom-3 start-3 text-[11px] px-2 py-1" style={{ background: 'rgba(11,11,12,.8)', color: INK }}>{after ? 'بعد' : 'قبل'}</span>
      </div>
      <p className="mt-[2vh] text-lg font-light" style={{ color: INK }}>{s.t}</p>
      <p key={l} className="mt-2 text-sm font-light" style={{ color: MUTED, animation: 'fadeIn 1s ease' }}>{LINES[l]}</p>
    </div>
  );
}

function Bill({ s }) {
  return (
    <div className="h-full flex flex-col px-10 py-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <img src="/images/cobblers-official-mark-white.png" alt="" className="h-12 w-auto" />
        <span className="text-sm" style={{ color: MUTED }}>{s.mode === 'sale' ? 'فاتورة مبيعات' : 'طلب جديد'}</span>
      </div>
      {s.name && <p className="text-2xl font-light mb-6" style={{ color: INK }}>أهلاً {s.name}</p>}
      <div className="flex-1 overflow-y-auto">
        {(s.lines || []).map((ln, k) => (
          <div key={k} className="flex items-baseline justify-between py-3" style={{ borderBottom: `1px solid ${HAIR}` }}>
            <span className="text-lg" style={{ color: INK }}>{ln.label}{ln.qty > 1 ? <span style={{ color: MUTED }}> × {ln.qty}</span> : null}</span>
            {ln.amount != null && <span className="text-lg" style={{ color: '#bdb8ad' }}><SarAmount value={Number(ln.amount).toFixed(2)} /></span>}
          </div>
        ))}
      </div>
      <div className="pt-6 space-y-2">
        {s.subtotal != null && <div className="flex justify-between text-sm" style={{ color: MUTED }}><span>قبل الضريبة</span><span><SarAmount value={Number(s.subtotal).toFixed(2)} /></span></div>}
        {s.vat != null && <div className="flex justify-between text-sm" style={{ color: MUTED }}><span>ضريبة القيمة المضافة 15%</span><span><SarAmount value={Number(s.vat).toFixed(2)} /></span></div>}
        <div className="flex justify-between items-baseline pt-3" style={{ borderTop: `1px solid ${GOLD}` }}>
          <span className="text-xl" style={{ color: GOLD }}>الإجمالي</span>
          <span className="text-5xl font-light" style={{ color: INK }}><SarAmount value={Number(s.total || 0).toFixed(2)} /></span>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDisplay() {
  const [state, setState] = useState(null);
  useEffect(() => subscribeDisplay(setState), []);
  // لو توقفت التحديثات 3 دقائق (نسيان فاتورة مفتوحة) نرجع للعرض الفاخر
  useEffect(() => { if (!state) return; const t = setTimeout(() => setState(null), 180000); return () => clearTimeout(t); }, [state]);
  const active = state && (state.total > 0 || (state.lines || []).length);
  return (
    <div dir="rtl" className="fixed inset-0" style={{ background: '#060300', color: INK, cursor: 'none' }}>
      <Helmet><title>إبرة وخيط الإسكافي</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <style>{'@keyframes fadeIn{from{opacity:0}to{opacity:1}}'}</style>
      {active ? <Bill s={state} /> : <Idle />}
    </div>
  );
}
