/**
 * cleanup-old-photos Edge Function
 * ─────────────────────────────────────────────────────────────
 * يحذف تلقائياً:
 *  - صور الطلبات (جدول orders، عمود photos)
 *  - صور الحجوزات (جدول bookings، عمود item_photos)
 * التي مرّ عليها أكثر من 14 يوماً منذ تاريخ إنشاء الطلب/الحجز
 * (وهو نفس وقت رفع الصور فعلياً، لأنها تُرفع أثناء إنشاء الطلب).
 *
 * يحذف الملفات الفعلية من bucket "order-photos"، ثم يفرّغ عمود
 * الصور في قاعدة البيانات ويسجّل وقت الحذف في photos_cleared_at.
 *
 * الجدولة: يُستدعى يومياً عبر pg_cron (راجع الهجرة 005) أو يدوياً
 * عبر: curl -X POST <FUNCTION_URL> -H "x-cleanup-secret: <SECRET>"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// سرّ بسيط يمنع أي شخص من استدعاء الدالة عشوائياً من الإنترنت
// (الدالة تعمل بدون تحقق JWT حتى يقدر cron يستدعيها بسهولة).
const CLEANUP_SECRET    = Deno.env.get('CLEANUP_SECRET') || '';

const RETENTION_DAYS = 14;
const PHOTOS_BUCKET  = 'order-photos';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
};

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // حماية بسيطة — إذا كان CLEANUP_SECRET مضبوطاً، لازم يُرسَل بنفس القيمة
  if (CLEANUP_SECRET && req.headers.get('x-cleanup-secret') !== CLEANUP_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const summary = {
    orders_cleaned: 0,
    bookings_cleaned: 0,
    files_deleted: 0,
    errors: [] as string[],
  };

  try {
    // ── 1) صور الطلبات (orders.photos) ──────────────────────
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, photos')
      .lt('created_at', cutoff)
      .is('photos_cleared_at', null)
      .not('photos', 'is', null);

    if (ordersErr) throw new Error(`orders query: ${ordersErr.message}`);

    for (const order of orders || []) {
      const photos: string[] = Array.isArray(order.photos) ? order.photos : [];
      if (photos.length === 0) continue;

      const paths = photos.map((u) => extractStoragePath(u, PHOTOS_BUCKET)).filter(Boolean) as string[];
      if (paths.length > 0) {
        const { error: removeErr } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
        if (removeErr) summary.errors.push(`order ${order.id}: ${removeErr.message}`);
        else summary.files_deleted += paths.length;
      }

      const { error: updateErr } = await supabase
        .from('orders')
        .update({ photos: [], photos_cleared_at: new Date().toISOString() })
        .eq('id', order.id);
      if (updateErr) summary.errors.push(`order ${order.id} update: ${updateErr.message}`);
      else summary.orders_cleaned++;
    }

    // ── 2) صور الحجوزات (bookings.item_photos) ──────────────
    const { data: bookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('id, item_photos')
      .lt('created_at', cutoff)
      .is('item_photos_cleared_at', null)
      .not('item_photos', 'is', null);

    if (bookingsErr) throw new Error(`bookings query: ${bookingsErr.message}`);

    for (const booking of bookings || []) {
      const photos: string[] = Array.isArray(booking.item_photos) ? booking.item_photos : [];
      if (photos.length === 0) continue;

      const paths = photos.map((u) => extractStoragePath(u, PHOTOS_BUCKET)).filter(Boolean) as string[];
      if (paths.length > 0) {
        const { error: removeErr } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
        if (removeErr) summary.errors.push(`booking ${booking.id}: ${removeErr.message}`);
        else summary.files_deleted += paths.length;
      }

      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ item_photos: [], item_photos_cleared_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (updateErr) summary.errors.push(`booking ${booking.id} update: ${updateErr.message}`);
      else summary.bookings_cleaned++;
    }

    return new Response(JSON.stringify({ ok: true, cutoff, ...summary }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err), ...summary }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
