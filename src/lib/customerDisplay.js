// قناة بين شاشة الكاشير وشاشة العميل (نافذة ثانية على نفس الجهاز) — بدون سيرفر وبدون تخزين.
const NAME = 'nt-customer-display';
let ch = null;
const channel = () => { try { return (ch ||= new BroadcastChannel(NAME)); } catch { return null; } };

/** state: null = عودة للعرض الفاخر، أو { mode:'order'|'sale', name, lines:[{label,qty,amount}], subtotal, vat, total } */
export function publishDisplay(state) { channel()?.postMessage({ t: Date.now(), state }); }
export function subscribeDisplay(cb) {
  const c = new BroadcastChannel(NAME);
  c.onmessage = (e) => cb(e.data?.state ?? null);
  return () => c.close();
}
export function openCustomerDisplay() {
  window.open('/customer-display', 'nt-customer-display', 'popup=yes,width=1280,height=800');
}
