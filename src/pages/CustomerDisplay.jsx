/**
 * CustomerDisplay — شاشة العميل (/customer-display)
 * ست تصاميم نهارية (خلفيات فاتحة وتباين عالٍ تُقرأ تحت الإضاءة القوية). التبديل:
 *   - من نافذة الشاشة نفسها بالضغط على الأرقام 1 إلى 6 (يُحفظ الاختيار)، أو ?theme=3 في الرابط.
 *   - ?demo=1 يعرض فاتورة تجريبية لاختبار الشاشة بدون فتح طلب.
 * عند وجود فاتورة يظهر الحساب بوضوح، وإلا يظهر العرض الترحيبي (قبل/بعد). كل الأحجام بوحدات vh/vw فتناسب أي شاشة.
 */
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { subscribeDisplay } from '@/lib/customerDisplay';
import { SarAmount } from '@/components/shared/SarCurrency';

const SLIDES = [
  { before: '/images/gallery/bag-before.png', after: '/images/gallery/bag-after.png', t: 'نعيد للحقيبة حياتها' },
  { before: '/images/gallery/sneaker-before.png', after: '/images/gallery/sneaker-after.png', t: 'نرمّم ما ظننته انتهى' },
];
const LINES = ['كل قطعة لها قصة، ونكتب فصلها التالي بأيدٍ سعودية', 'ضمان 30 يوماً على أعمال الترميم', 'تتبّع قطعتك من needlecobbler.com/track'];
const LOGO = '/images/cobblers-official-mark.png';
const DEMO = { mode: 'order', name: 'محمد', lines: [{ label: 'حقيبة — تنظيف عميق' }, { label: 'حقيبة — إعادة صبغ' }, { label: 'حذاء — تغيير نعل' }], subtotal: 260.87, vat: 39.13, total: 300 };
const money = (v) => <SarAmount value={Number(v || 0).toFixed(2)} />;

function useIdle() {
  const [i, setI] = useState(0), [after, setAfter] = useState(false), [l, setL] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setAfter((v) => !v), 3500);
    const b = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 9000);
    const c = setInterval(() => setL((v) => (v + 1) % LINES.length), 6000);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, []);
  return { s: SLIDES[i], after, line: LINES[l], l };
}
const Fade = ({ src, show, style }) => <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: show ? 1 : 0, transition: 'opacity 1.4s ease', ...style }} />;
const note = (s) => (s.total > 0 ? null : 'السعر يُحدَّد بعد التقييم المجاني');

/* ───────── 1) عاج ناصع — فاتورة ورقية كلاسيكية ───────── */
const L1 = { bg: '#fbf8f2', ink: '#14100c', acc: '#7a3e1d', soft: '#f3e8d4' };
function Idle1() {
  const { s, after, line } = useIdle();
  return (
    <div className="h-full flex flex-col items-center justify-center text-center" style={{ background: L1.bg, color: L1.ink }}>
      <img src={LOGO} alt="" style={{ height: '19vh' }} />
      <div className="flex gap-[2vw] mt-[3vh]">
        {[['قبل', s.before], ['بعد', s.after]].map(([lab, src]) => (
          <div key={lab} className="relative overflow-hidden" style={{ width: '27vw', height: '36vh', border: `0.5vh solid ${L1.ink}`, borderRadius: '1.5vh' }}>
            <img src={src} alt="" className="w-full h-full object-cover" />
            <span className="absolute top-[1.5vh] right-[1.5vh] px-[1.4vh] py-[.6vh] font-black" style={{ background: L1.ink, color: '#fff', fontSize: '2.4vh', borderRadius: '.8vh' }}>{lab}</span>
          </div>
        ))}
      </div>
      <p className="mt-[3vh] font-black" style={{ fontSize: '5vh', color: L1.acc }}>{s.t}</p>
      <p key={line} className="mt-[1vh]" style={{ fontSize: '2.8vh', animation: 'fadeIn 1s ease' }}>{line}</p>
    </div>
  );
}
function Bill1({ s }) {
  return (
    <div className="h-full flex items-center justify-center" style={{ background: L1.bg, color: L1.ink }}>
      <div className="w-[70vw] max-h-[92vh] flex flex-col p-[4vh]" style={{ background: '#fff', border: `0.5vh solid ${L1.ink}`, borderRadius: '2vh', boxShadow: '1.2vh 1.2vh 0 ' + L1.ink }}>
        <div className="flex items-center justify-between"><img src={LOGO} alt="" style={{ height: '9vh' }} /><span className="font-black" style={{ fontSize: '3vh' }}>{s.mode === 'sale' ? 'فاتورة مبيعات' : 'طلب جديد'}</span></div>
        {s.name && <p className="mt-[2vh] font-black" style={{ fontSize: '4.4vh' }}>أهلاً {s.name}</p>}
        <div className="flex-1 overflow-y-auto mt-[2vh]">{(s.lines || []).map((ln, k) => (
          <div key={k} className="flex justify-between py-[1.6vh]" style={{ borderBottom: `0.3vh dashed ${L1.ink}55`, fontSize: '3.6vh', fontWeight: 800 }}><span>{ln.label}{ln.qty > 1 ? ` × ${ln.qty}` : ''}</span>{ln.amount != null && <span>{money(ln.amount)}</span>}</div>))}</div>
        {s.total > 0 ? (
          <div className="mt-[2vh] p-[2.4vh] flex items-baseline justify-between" style={{ background: L1.soft, borderRadius: '1.6vh' }}>
            <div style={{ fontSize: '2.4vh' }}><div>قبل الضريبة {money(s.subtotal)}</div><div>ضريبة 15% {money(s.vat)}</div></div>
            <div className="text-left"><div className="font-black" style={{ fontSize: '3vh', color: L1.acc }}>الإجمالي</div><div className="font-black" style={{ fontSize: '10vh', lineHeight: 1 }}>{money(s.total)}</div></div>
          </div>
        ) : <p className="mt-[2vh] font-black text-center" style={{ fontSize: '4vh', color: L1.acc }}>{note(s)}</p>}
      </div>
    </div>
  );
}

/* ───────── 2) نهار الصحراء — لوحة إجمالي كبيرة ملوّنة + قائمة ───────── */
const L2 = { bg: 'linear-gradient(135deg,#fde7c4,#fff6e6)', ink: '#2a1408', acc: '#b4421a' };
function Idle2() {
  const { s, after, line } = useIdle();
  return (
    <div className="h-full relative overflow-hidden" style={{ background: L2.bg, color: L2.ink }}>
      <div className="absolute inset-y-0 left-0 w-[62vw]"><Fade src={s.before} show={!after} /><Fade src={s.after} show={after} /><div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,transparent 60%,rgba(253,231,196,.95))' }} /></div>
      <div className="absolute inset-y-0 right-0 w-[42vw] flex flex-col justify-center pr-[4vw] pl-[2vw]">
        <img src={LOGO} alt="" style={{ height: '16vh', alignSelf: 'flex-start' }} />
        <p className="mt-[4vh] font-black" style={{ fontSize: '8vh', lineHeight: 1.15, color: L2.acc }}>{s.t}</p>
        <p key={line} className="mt-[3vh] font-bold" style={{ fontSize: '3vh', animation: 'fadeIn 1s ease' }}>{line}</p>
        <span className="mt-[3vh] self-start px-[2vh] py-[1vh] font-black text-white" style={{ background: L2.acc, fontSize: '2.6vh', borderRadius: '5vh' }}>{after ? 'بعد الترميم' : 'قبل الترميم'}</span>
      </div>
    </div>
  );
}
function Bill2({ s }) {
  return (
    <div className="h-full flex" style={{ background: L2.bg, color: L2.ink }}>
      <div className="w-[38vw] flex flex-col justify-center items-center text-center text-white p-[3vw]" style={{ background: L2.acc }}>
        <p className="font-black" style={{ fontSize: '3.4vh' }}>{s.total > 0 ? 'الإجمالي المستحق' : 'طلبك قيد التسجيل'}</p>
        {s.total > 0 ? <p className="font-black" style={{ fontSize: '13vh', lineHeight: 1.1 }}>{money(s.total)}</p> : <p className="font-black mt-[2vh]" style={{ fontSize: '4.4vh' }}>{note(s)}</p>}
        {s.total > 0 && <p style={{ fontSize: '2.4vh', opacity: .95 }}>شامل ضريبة 15% ({money(s.vat)})</p>}
      </div>
      <div className="flex-1 p-[4vh] flex flex-col">
        <div className="flex items-center justify-between"><img src={LOGO} alt="" style={{ height: '10vh' }} /><span className="font-black" style={{ fontSize: '3vh' }}>{s.mode === 'sale' ? 'فاتورة مبيعات' : 'طلب جديد'}</span></div>
        {s.name && <p className="font-black mt-[3vh]" style={{ fontSize: '5vh' }}>أهلاً {s.name} 👋</p>}
        <div className="mt-[2vh] flex-1 overflow-y-auto">{(s.lines || []).map((ln, k) => (
          <div key={k} className="flex justify-between items-center mb-[1.6vh] px-[2.4vh] py-[2vh] bg-white" style={{ borderRadius: '2vh', fontSize: '3.6vh', fontWeight: 800, boxShadow: '0 .6vh 1.6vh rgba(120,60,20,.15)' }}><span>{ln.label}{ln.qty > 1 ? ` × ${ln.qty}` : ''}</span>{ln.amount != null && <span style={{ color: L2.acc }}>{money(ln.amount)}</span>}</div>))}</div>
      </div>
    </div>
  );
}

/* ───────── 3) مرمر وذهب — فخامة هادئة ───────── */
const L3 = { bg: 'radial-gradient(circle at 50% 30%,#ffffff,#eceae4)', ink: '#1c1a17', gold: '#8c6414' };
function Idle3() {
  const { s, after, line } = useIdle();
  return (
    <div className="h-full flex flex-col items-center justify-center text-center" style={{ background: L3.bg, color: L3.ink }}>
      <img src={LOGO} alt="" style={{ height: '13vh' }} />
      <div className="relative overflow-hidden mt-[3vh]" style={{ width: '30vw', height: '50vh', borderRadius: '15vw 15vw 1vh 1vh', border: `.5vh solid ${L3.gold}`, boxShadow: '0 3vh 6vh rgba(0,0,0,.18)' }}>
        <Fade src={s.before} show={!after} style={{ animation: 'kb 12s ease-in-out infinite alternate' }} /><Fade src={s.after} show={after} style={{ animation: 'kb 12s ease-in-out infinite alternate' }} />
      </div>
      <p className="mt-[3vh] font-black" style={{ fontSize: '5vh', letterSpacing: '.3vh' }}>{s.t}</p>
      <div style={{ width: '12vw', height: '.4vh', background: L3.gold, margin: '1.6vh 0' }} />
      <p key={line} style={{ fontSize: '2.6vh', animation: 'fadeIn 1s ease' }}>{line}</p>
    </div>
  );
}
function Bill3({ s }) {
  return (
    <div className="h-full flex flex-col items-center justify-center" style={{ background: L3.bg, color: L3.ink }}>
      <img src={LOGO} alt="" style={{ height: '11vh' }} />
      <div className="w-[56vw] mt-[2vh]" style={{ borderTop: `.4vh solid ${L3.gold}`, borderBottom: `.4vh solid ${L3.gold}`, padding: '2vh 0' }}>
        {s.name && <p className="text-center font-black" style={{ fontSize: '4.4vh' }}>أهلاً {s.name}</p>}
        <div className="mt-[1.6vh] max-h-[40vh] overflow-y-auto">{(s.lines || []).map((ln, k) => (
          <div key={k} className="flex items-baseline gap-[1vw] py-[1.2vh]" style={{ fontSize: '3.4vh', fontWeight: 700 }}><span>{ln.label}{ln.qty > 1 ? ` × ${ln.qty}` : ''}</span><span className="flex-1" style={{ borderBottom: `.3vh dotted ${L3.ink}77`, transform: 'translateY(-.6vh)' }} />{ln.amount != null && <span>{money(ln.amount)}</span>}</div>))}</div>
      </div>
      {s.total > 0 ? <div className="mt-[3vh] text-center px-[5vw] py-[2vh]" style={{ border: `.5vh solid ${L3.gold}` }}><p className="font-black" style={{ fontSize: '2.8vh', color: L3.gold, letterSpacing: '.5vh' }}>الإجمالي</p><p className="font-black" style={{ fontSize: '11vh', lineHeight: 1.1 }}>{money(s.total)}</p><p style={{ fontSize: '2.2vh' }}>شامل الضريبة 15%</p></div>
        : <p className="mt-[3vh] font-black" style={{ fontSize: '4vh', color: L3.gold }}>{note(s)}</p>}
    </div>
  );
}

/* ───────── 4) سماء حديثة — بطاقات وشريط إجمالي ───────── */
const L4 = { bg: 'linear-gradient(180deg,#dff0ff,#ffffff)', ink: '#0b1b33', acc: '#0a56d6' };
function Idle4() {
  const { s, line } = useIdle();
  const [p, setP] = useState(0);
  useEffect(() => { let r, t0 = performance.now(); const f = (t) => { setP(((t - t0) / 5000) % 2); r = requestAnimationFrame(f); }; r = requestAnimationFrame(f); return () => cancelAnimationFrame(r); }, []);
  const x = p < 1 ? p : 2 - p;
  return (
    <div className="h-full flex flex-col items-center justify-center" style={{ background: L4.bg, color: L4.ink }}>
      <img src={LOGO} alt="" style={{ height: '12vh' }} />
      <div className="relative overflow-hidden mt-[3vh]" style={{ width: '62vw', height: '50vh', borderRadius: '4vh', boxShadow: '0 3vh 7vh rgba(10,86,214,.25)' }}>
        <img src={s.before} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <img src={s.after} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ clipPath: `inset(0 ${(1 - x) * 100}% 0 0)` }} />
        <div className="absolute inset-y-0" style={{ right: `${x * 100}%`, width: '.8vh', background: '#fff', boxShadow: '0 0 3vh rgba(255,255,255,.9)' }} />
        <span className="absolute top-[2vh] right-[2vh] px-[2vh] py-[.8vh] font-black text-white" style={{ background: L4.acc, borderRadius: '3vh', fontSize: '2.4vh' }}>بعد</span>
        <span className="absolute top-[2vh] left-[2vh] px-[2vh] py-[.8vh] font-black" style={{ background: '#fff', borderRadius: '3vh', fontSize: '2.4vh' }}>قبل</span>
      </div>
      <p className="mt-[3vh] font-black" style={{ fontSize: '5.2vh', color: L4.acc }}>{s.t}</p>
      <p key={line} className="font-bold mt-[1vh]" style={{ fontSize: '2.8vh', animation: 'fadeIn 1s ease' }}>{line}</p>
    </div>
  );
}
function Bill4({ s }) {
  return (
    <div className="h-full flex flex-col" style={{ background: L4.bg, color: L4.ink }}>
      <div className="flex items-center justify-between px-[4vw] pt-[3vh]"><img src={LOGO} alt="" style={{ height: '9vh' }} /><span className="font-black px-[2vh] py-[.8vh] text-white" style={{ background: L4.acc, borderRadius: '3vh', fontSize: '2.6vh' }}>{s.mode === 'sale' ? 'فاتورة مبيعات' : 'طلب جديد'}</span></div>
      {s.name && <p className="px-[4vw] mt-[2vh] font-black" style={{ fontSize: '5vh' }}>أهلاً {s.name}</p>}
      <div className="flex-1 overflow-y-auto px-[4vw] mt-[2vh] grid grid-cols-2 gap-[2vh] content-start">{(s.lines || []).map((ln, k) => (
        <div key={k} className="bg-white p-[2.4vh] flex flex-col justify-between" style={{ borderRadius: '3vh', minHeight: '16vh', boxShadow: '0 1vh 3vh rgba(10,86,214,.15)' }}><span className="font-black" style={{ fontSize: '3.4vh' }}>{ln.label}{ln.qty > 1 ? ` × ${ln.qty}` : ''}</span>{ln.amount != null && <span className="font-black" style={{ fontSize: '3vh', color: L4.acc }}>{money(ln.amount)}</span>}</div>))}</div>
      <div className="flex items-center justify-between px-[4vw] py-[3vh] text-white" style={{ background: L4.acc, borderRadius: '5vh 5vh 0 0' }}>
        <span style={{ fontSize: '2.4vh' }}>{s.total > 0 ? <>شامل الضريبة 15% — {money(s.vat)}</> : note(s)}</span>
        {s.total > 0 && <span className="font-black" style={{ fontSize: '10vh', lineHeight: 1 }}>{money(s.total)}</span>}
      </div>
    </div>
  );
}

/* ───────── 5) افتتاحية — تايبوغرافي ضخم أبيض وأسود ───────── */
const L5 = { bg: '#ffffff', ink: '#050505', acc: '#d4150b' };
function Idle5() {
  const { s, after, line } = useIdle();
  return (
    <div className="h-full relative overflow-hidden" style={{ background: L5.bg, color: L5.ink }}>
      <p className="absolute font-black select-none" style={{ fontSize: '46vh', lineHeight: .9, top: '-4vh', right: '-1vw', color: '#f0f0f0', whiteSpace: 'nowrap' }}>{after ? 'بعد' : 'قبل'}</p>
      <div className="absolute" style={{ left: '5vw', top: '8vh', width: '38vw', height: '78vh', border: `.8vh solid ${L5.ink}` }}><Fade src={s.before} show={!after} /><Fade src={s.after} show={after} /></div>
      <div className="absolute flex flex-col justify-between" style={{ right: '5vw', top: '8vh', bottom: '14vh', width: '46vw' }}>
        <img src={LOGO} alt="" style={{ height: '14vh', alignSelf: 'flex-start' }} />
        <div><p className="font-black" style={{ fontSize: '9.5vh', lineHeight: 1.1 }}>{s.t}</p><div style={{ width: '14vw', height: '1.2vh', background: L5.acc, marginTop: '2vh' }} /></div>
        <p key={line} className="font-black" style={{ fontSize: '3.2vh', animation: 'fadeIn 1s ease' }}>{line}</p>
      </div>
    </div>
  );
}
function Bill5({ s }) {
  return (
    <div className="h-full flex flex-col px-[5vw] py-[4vh]" style={{ background: L5.bg, color: L5.ink }}>
      <div className="flex items-end justify-between pb-[2vh]" style={{ borderBottom: `1vh solid ${L5.ink}` }}><img src={LOGO} alt="" style={{ height: '9vh' }} /><span className="font-black" style={{ fontSize: '4vh' }}>{s.mode === 'sale' ? 'فاتورة مبيعات' : 'طلب جديد'}{s.name ? ` · ${s.name}` : ''}</span></div>
      <div className="flex-1 overflow-y-auto">{(s.lines || []).map((ln, k) => (
        <div key={k} className="flex justify-between py-[2vh]" style={{ borderBottom: `.5vh solid ${L5.ink}`, fontSize: '4.2vh', fontWeight: 900 }}><span>{ln.label}{ln.qty > 1 ? ` × ${ln.qty}` : ''}</span>{ln.amount != null && <span>{money(ln.amount)}</span>}</div>))}</div>
      <div className="flex items-end justify-between pt-[2vh]">
        <span className="font-black" style={{ fontSize: '4vh' }}>{s.total > 0 ? 'الإجمالي' : note(s)}</span>
        {s.total > 0 && <span className="font-black" style={{ fontSize: '19vh', lineHeight: .95, borderBottom: `1.4vh solid ${L5.acc}` }}>{money(s.total)}</span>}
      </div>
    </div>
  );
}

/* ───────── 6) ورق حرفي — كرافت وخيط وبولارويد ───────── */
const L6 = { bg: 'repeating-linear-gradient(45deg,#dcc7a3,#dcc7a3 6px,#d6bf99 6px,#d6bf99 12px)', paper: '#fbf3e2', ink: '#2b1d10', acc: '#2f5a1c', thread: '#8a4b22' };
function Idle6() {
  const { s, line } = useIdle();
  return (
    <div className="h-full flex items-center justify-center" style={{ background: L6.bg, color: L6.ink }}>
      <div className="relative flex flex-col items-center justify-center" style={{ width: '92vw', height: '90vh', background: L6.paper, border: `.7vh dashed ${L6.thread}`, borderRadius: '2vh', boxShadow: '0 2vh 5vh rgba(60,35,10,.3)' }}>
        <img src={LOGO} alt="" style={{ height: '14vh' }} />
        <div className="flex gap-[3vw] mt-[2vh]">
          {[['قبل', s.before, -4], ['بعد', s.after, 3]].map(([lab, src, r]) => (
            <div key={lab} className="bg-white p-[1.2vh] pb-[5vh] relative" style={{ transform: `rotate(${r}deg)`, boxShadow: '0 1.4vh 3vh rgba(0,0,0,.3)' }}>
              <img src={src} alt="" style={{ width: '24vw', height: '30vh', objectFit: 'cover' }} /><span className="absolute bottom-[1vh] inset-x-0 text-center font-black" style={{ fontSize: '3vh' }}>{lab}</span>
            </div>))}
        </div>
        <p className="mt-[2vh] font-black" style={{ fontSize: '4.6vh', color: L6.acc }}>{s.t}</p>
        <p key={line} className="font-bold" style={{ fontSize: '2.6vh', animation: 'fadeIn 1s ease' }}>{line}</p>
      </div>
    </div>
  );
}
function Bill6({ s }) {
  return (
    <div className="h-full flex items-center justify-center" style={{ background: L6.bg, color: L6.ink }}>
      <div className="relative flex flex-col p-[4vh]" style={{ width: '62vw', maxHeight: '94vh', background: L6.paper, border: `.7vh dashed ${L6.thread}`, borderRadius: '1.4vh', transform: 'rotate(-.8deg)', boxShadow: '0 2vh 5vh rgba(60,35,10,.35)' }}>
        <div className="flex items-center justify-between"><img src={LOGO} alt="" style={{ height: '9vh' }} /><span className="font-black" style={{ fontSize: '3vh' }}>{s.mode === 'sale' ? 'فاتورة مبيعات' : 'طلب جديد'}</span></div>
        {s.name && <p className="font-black mt-[1.6vh]" style={{ fontSize: '4.4vh' }}>أهلاً {s.name} ✂️</p>}
        <div className="flex-1 overflow-y-auto mt-[1.6vh]">{(s.lines || []).map((ln, k) => (
          <div key={k} className="flex justify-between py-[1.6vh]" style={{ borderBottom: `.4vh dashed ${L6.thread}88`, fontSize: '3.6vh', fontWeight: 800 }}><span>{ln.label}{ln.qty > 1 ? ` × ${ln.qty}` : ''}</span>{ln.amount != null && <span>{money(ln.amount)}</span>}</div>))}</div>
        {s.total > 0 ? <div className="mt-[2vh] text-center py-[2vh]" style={{ background: L6.acc, color: '#fff', borderRadius: '1.4vh' }}><p className="font-black" style={{ fontSize: '2.8vh' }}>الإجمالي شامل الضريبة</p><p className="font-black" style={{ fontSize: '11vh', lineHeight: 1.05 }}>{money(s.total)}</p></div>
          : <p className="mt-[2vh] font-black text-center" style={{ fontSize: '4vh', color: L6.acc }}>{note(s)}</p>}
      </div>
    </div>
  );
}

const THEMES = [[Idle1, Bill1], [Idle2, Bill2], [Idle3, Bill3], [Idle4, Bill4], [Idle5, Bill5], [Idle6, Bill6]];
const readTheme = () => {
  try {
    const q = new URLSearchParams(window.location.search).get('theme');
    const n = parseInt(q || localStorage.getItem('nt-display-theme') || '1', 10);
    return n >= 1 && n <= 6 ? n : 1;
  } catch { return 1; }
};

export default function CustomerDisplay() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [state, setState] = useState(params.get('demo') === '1' ? DEMO : null);
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => subscribeDisplay(setState), []);
  useEffect(() => {
    const h = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 6) { setTheme(n); try { localStorage.setItem('nt-display-theme', String(n)); } catch { /* ignore */ } } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  // لو توقف النبض (إغلاق صفحة الكاشير) نرجع للعرض الترحيبي بعد 45 ثانية، والكاشير يرسل نبضاً كل 10 ثوانٍ طالما الفاتورة مفتوحة
  useEffect(() => { if (!state || params.get('demo') === '1') return; const t = setTimeout(() => setState(null), 45000); return () => clearTimeout(t); }, [state]); // eslint-disable-line
  const active = state && (state.total > 0 || (state.lines || []).length);
  const [Idle, Bill] = THEMES[theme - 1];
  return (
    <div dir="rtl" className="fixed inset-0" style={{ cursor: 'none', fontFamily: 'inherit' }}>
      <Helmet><title>إبرة وخيط الإسكافي</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <style>{'@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes kb{from{transform:scale(1)}to{transform:scale(1.12)}}'}</style>
      {active ? <Bill s={state} /> : <Idle />}
    </div>
  );
}
