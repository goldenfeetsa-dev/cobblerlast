// قناة بين شاشة الكاشير وشاشة العميل (نافذة ثانية على نفس المتصفح/الجهاز) — بدون سيرفر.
// ثلاث طبقات لضمان الظهور: BroadcastChannel + مصافحة عند فتح الشاشة (ترسل آخر حالة) + نبض كل 10 ثوانٍ + localStorage احتياطي.
const NAME = 'nt-customer-display';
const KEY = 'nt-customer-display-state';
let ch = null, last = null, hb = null;
const channel = () => {
  try {
    if (!ch) {
      ch = new BroadcastChannel(NAME);
      ch.onmessage = (e) => { if (e.data?.hello && last) post(); };   // الشاشة فُتحت للتو وتطلب الحالة الحالية
    }
    return ch;
  } catch { return null; }
};
const post = () => channel()?.postMessage({ t: Date.now(), state: last });
if (typeof window !== 'undefined') channel();

/** state: null = عودة للعرض الفاخر، أو { mode:'order'|'sale', name, lines:[{label,qty,amount}], subtotal, vat, total } */
export function publishDisplay(state) {
  last = state;
  try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), state })); } catch { /* ignore */ }
  post();
  clearInterval(hb);
  if (state) hb = setInterval(post, 10000);
}
/** شاشة شكر بعد حفظ الطلب ثم عودة تلقائية للعرض الترحيبي */
let thanksTimer = null;
export function publishThanks(payload, ms = 9000) {
  publishDisplay({ mode: 'thanks', ...payload });
  clearTimeout(thanksTimer);
  thanksTimer = setTimeout(() => publishDisplay(null), ms);
}
export function subscribeDisplay(cb) {
  let c = null;
  try { c = new BroadcastChannel(NAME); c.onmessage = (e) => { if (!e.data?.hello) cb(e.data?.state ?? null); }; c.postMessage({ hello: true }); } catch { /* ignore */ }
  const onStorage = (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { cb(JSON.parse(e.newValue).state ?? null); } catch { /* ignore */ }
  };
  window.addEventListener('storage', onStorage);
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && Date.now() - v.t < 40000) cb(v.state ?? null); } catch { /* ignore */ }
  return () => { c?.close(); window.removeEventListener('storage', onStorage); };
}
export function openCustomerDisplay() {
  window.open('/customer-display', 'nt-customer-display', 'popup=yes,width=1280,height=800');
}
