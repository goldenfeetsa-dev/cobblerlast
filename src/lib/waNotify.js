// إشعار العميل على واتساب بجاهزية الطلب (السيرفر يتحقق من الجلسة ويمنع التكرار)
export function notifyOrderReady(orderId) {
  try {
    if (!orderId) return;
    fetch('/api/secure/data?resource=wa-notify', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    }).catch(() => {});
  } catch { /* اختياري */ }
}
