-- ============================================================
-- 004_storage_buckets_and_photo_cleanup.sql
-- 1) إنشاء مساحات التخزين الناقصة (order-photos, brands, branding)
--    وسياسات الوصول لها (نفس نمط shop-products الموجود مسبقاً).
-- 2) أعمدة لتتبّع تاريخ حذف صور الطلبات/الحجوزات تلقائياً.
-- شغّل هذا الملف كاملاً في: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ── 1) Storage Buckets ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('order-photos', 'order-photos', true),
  ('brands',       'brands',       true),
  ('branding',     'branding',     true)
ON CONFLICT (id) DO NOTHING;

-- order-photos: أي شخص يرفع صورة عند الحجز/إنشاء الطلب (بدون تسجيل دخول)
DROP POLICY IF EXISTS "public_read_order_photos"   ON storage.objects;
DROP POLICY IF EXISTS "anyone_upload_order_photos" ON storage.objects;
DROP POLICY IF EXISTS "anyone_delete_order_photos" ON storage.objects;
CREATE POLICY "public_read_order_photos"   ON storage.objects FOR SELECT USING (bucket_id = 'order-photos');
CREATE POLICY "anyone_upload_order_photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'order-photos');
CREATE POLICY "anyone_delete_order_photos" ON storage.objects FOR DELETE USING (bucket_id = 'order-photos');

-- brands: شعارات الماركات (لوحة التحكم)
DROP POLICY IF EXISTS "public_read_brands"   ON storage.objects;
DROP POLICY IF EXISTS "anyone_upload_brands" ON storage.objects;
DROP POLICY IF EXISTS "anyone_delete_brands" ON storage.objects;
CREATE POLICY "public_read_brands"   ON storage.objects FOR SELECT USING (bucket_id = 'brands');
CREATE POLICY "anyone_upload_brands" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'brands');
CREATE POLICY "anyone_delete_brands" ON storage.objects FOR DELETE USING (bucket_id = 'brands');

-- branding: شعار المتجر العام (الإعدادات)
DROP POLICY IF EXISTS "public_read_branding"   ON storage.objects;
DROP POLICY IF EXISTS "anyone_upload_branding" ON storage.objects;
DROP POLICY IF EXISTS "anyone_delete_branding" ON storage.objects;
CREATE POLICY "public_read_branding"   ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "anyone_upload_branding" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding');
CREATE POLICY "anyone_delete_branding" ON storage.objects FOR DELETE USING (bucket_id = 'branding');

-- ── 2) أعمدة تتبّع حذف الصور تلقائياً ───────────────────────
-- تُملأ بالتاريخ من دالة cleanup-old-photos عند حذف صور طلب/حجز
-- تجاوز عمرها أسبوعين، حتى يبقى أثر واضح في السجل بدل اختفاء صامت.
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS photos_cleared_at      TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS item_photos_cleared_at TIMESTAMPTZ;

-- فهرس يسرّع بحث دالة التنظيف اليومية عن الطلبات/الحجوزات القديمة التي لديها صور
CREATE INDEX IF NOT EXISTS idx_orders_photos_cleanup
  ON orders (created_at) WHERE photos_cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_photos_cleanup
  ON bookings (created_at) WHERE item_photos_cleared_at IS NULL;
