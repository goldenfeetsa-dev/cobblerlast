-- ══════════════════════════════════════════════════════════
-- منتجات المتجر العام (Shop) — جدول مستقل عن مخزون الورشة الداخلي
-- ══════════════════════════════════════════════════════════
-- ⚠️ هذا الجدول لم يكن موجوداً إطلاقاً في قاعدة البيانات.
-- لوحة الإدارة (/admin/shop) كانت مبرمجة لتحفظ في جدول اسمه "products"
-- لكنه لم يُنشأ قط، فكانت عملية "حفظ" أي منتج تفشل بصمت (أو بخطأ
-- Bucket/Table not found) ولا يظهر أي منتج حقيقي في المتجر العام —
-- ولهذا كان المتجر يعرض دائماً صوراً عامة (Unsplash) بدل صور منتجاتك.
--
-- نفّذ هذا الملف مرة واحدة من: Supabase Dashboard → SQL Editor → New query

CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT,                        -- الاسم بالإنجليزي (اختياري)
  name_ar          TEXT NOT NULL,               -- الاسم بالعربي
  description      TEXT,
  category         TEXT NOT NULL DEFAULT 'other',
  price            NUMERIC(10,2) NOT NULL,
  original_price   NUMERIC(10,2),               -- السعر قبل الخصم (اختياري)
  image_url        TEXT,                        -- رابط صورة المنتج (من Supabase Storage)
  sku              TEXT,
  in_stock         BOOLEAN NOT NULL DEFAULT true,
  is_featured      BOOLEAN NOT NULL DEFAULT false,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);

-- ── RLS ─────────────────────────────────────────────────
-- نفس نمط الصلاحيات المستخدم في بقية الجداول بهذا المشروع
-- (التحقق من الهوية يتم داخل التطبيق عبر PIN، وليس عبر Supabase Auth).
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_products" ON products;
CREATE POLICY "service_all_products" ON products FOR ALL USING (true);

-- ══════════════════════════════════════════════════════════
-- مساحة تخزين صور المتجر (Storage bucket: shop-products)
-- ══════════════════════════════════════════════════════════
-- عام للقراءة (حتى تظهر الصور في المتجر وتُفهرَس في جوجل)
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-products', 'shop-products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public_read_shop_products" ON storage.objects;
CREATE POLICY "public_read_shop_products"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-products');

DROP POLICY IF EXISTS "anyone_upload_shop_products" ON storage.objects;
CREATE POLICY "anyone_upload_shop_products"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shop-products');
