/**
 * photoCleanup.js
 * حذف صور الطلبات المكتملة بعد مرور أسبوعين
 * - Frontend: يُخفي الصور في الواجهة ويحذف URLs من الـ DB
 * - يعمل عند فتح التطبيق مرة واحدة يومياً (throttled بـ localStorage)
 */
import { base44 } from '@/api/base44Client';

const LAST_CLEANUP_KEY = 'photo_cleanup_last_run';
const TWO_WEEKS_MS     = 14 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS       = 24 * 60 * 60 * 1000;

/**
 * تشغيل تنظيف الصور — يعمل مرة واحدة كل 24 ساعة فقط
 * يُستدعى من App.jsx عند تحميل التطبيق
 */
export async function runPhotoCleanup() {
  try {
    // Throttle: لا تشتغل أكثر من مرة يومياً
    const lastRun = localStorage.getItem(LAST_CLEANUP_KEY);
    if (lastRun && Date.now() - Number(lastRun) < ONE_DAY_MS) return;

    const now     = Date.now();
    const cutoff  = new Date(now - TWO_WEEKS_MS).toISOString();

    // جلب الطلبات المكتملة التي عمرها أكثر من أسبوعين وعندها صور
    const orders = await base44.entities.Order.list('-created_date', 500);
    const toClean = orders.filter(o =>
      o.order_status === 'completed' &&
      o.photos?.length > 0 &&
      o.created_date < cutoff
    );

    if (toClean.length === 0) {
      localStorage.setItem(LAST_CLEANUP_KEY, String(Date.now()));
      return;
    }

    console.info(`🧹 تنظيف صور ${toClean.length} طلب مكتمل (أقدم من أسبوعين)`);

    // حذف URLs من قاعدة البيانات (batch)
    await Promise.allSettled(
      toClean.map(o =>
        base44.entities.Order.update(o.id, {
          photos: [],
          photos_deleted_at: new Date().toISOString(),
        })
      )
    );

    localStorage.setItem(LAST_CLEANUP_KEY, String(Date.now()));
    console.info(`✅ تم حذف صور ${toClean.length} طلب`);
  } catch (err) {
    // لا نوقف التطبيق بسبب خطأ في التنظيف
    console.warn('Photo cleanup failed silently:', err);
  }
}

/**
 * هل يجب إخفاء صور هذا الطلب؟ (للعرض في الواجهة)
 * حتى لو لم يُشغَّل الـ cleanup بعد، نخفيها من الواجهة فوراً
 */
export function shouldHidePhotos(order) {
  if (!order?.photos?.length) return true;
  if (order.order_status !== 'completed') return false;
  if (!order.created_date) return false;
  return Date.now() - new Date(order.created_date).getTime() > TWO_WEEKS_MS;
}
