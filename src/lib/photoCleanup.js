// الحذف التلقائي للصور صار على الخادم (دالة photo-retention + pg_cron يومياً):
// طلبات منتهية > 30 يوماً، حجوزات > 60 يوماً، وملفات يتيمة. الطلبات المعلّمة keep_photos تبقى دائماً.
export async function runPhotoCleanup() { /* no-op: handled server-side */ }

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export function shouldHidePhotos(order) {
  if (!order?.photos?.length) return true;
  if (order.keep_photos) return false;
  if (order.status !== 'completed') return false;
  if (!order.created_at) return false;
  return Date.now() - new Date(order.created_at).getTime() > RETENTION_MS;
}
