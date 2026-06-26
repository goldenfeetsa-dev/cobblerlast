import { supabase } from '@/lib/supabaseClient';

const LAST_CLEANUP_KEY = 'photo_cleanup_last_run';
const TWO_WEEKS_MS     = 14 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS       = 24 * 60 * 60 * 1000;

export async function runPhotoCleanup() {
  try {
    const lastRun = localStorage.getItem(LAST_CLEANUP_KEY);
    if (lastRun && Date.now() - Number(lastRun) < ONE_DAY_MS) return;

    const cutoff = new Date(Date.now() - TWO_WEEKS_MS).toISOString();
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, photos, created_at')
      .eq('status', 'completed')
      .lt('created_at', cutoff)
      .not('photos', 'eq', '{}');

    if (!orders?.length) {
      localStorage.setItem(LAST_CLEANUP_KEY, String(Date.now()));
      return;
    }

    await Promise.allSettled(
      orders.map(o =>
        supabase.from('orders').update({
          photos: [],
          photos_deleted_at: new Date().toISOString(),
        }).eq('id', o.id)
      )
    );

    localStorage.setItem(LAST_CLEANUP_KEY, String(Date.now()));
  } catch (err) {
    console.warn('Photo cleanup failed silently:', err);
  }
}

export function shouldHidePhotos(order) {
  if (!order?.photos?.length) return true;
  if (order.status !== 'completed') return false;
  if (!order.created_at) return false;
  return Date.now() - new Date(order.created_at).getTime() > TWO_WEEKS_MS;
}
