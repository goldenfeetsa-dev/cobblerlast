-- ══════════════════════════════════════════════════════════
-- إصلاح شامل لقاعدة البيانات — الجداول والأعمدة الناقصة
-- ══════════════════════════════════════════════════════════
-- ⚠️ هذا هو سبب رسالة "فشل الحفظ" في أكثر من صفحة إدارة، وسبب
-- عدم ظهور بيانات الفروع/الخدمات/التقييمات/الماركات/أوقات
-- العمل/إعدادات المتجر في الموقع حتى بعد الحفظ: بعض هذه
-- الجداول لم تكن موجودة إطلاقاً في القاعدة، وبعضها كان ناقص
-- أعمدة تحتاجها لوحة الإدارة.
--
-- نفّذ هذا الملف مرة واحدة من: Supabase Dashboard → SQL Editor → New query
-- الأوامر كلها آمنة (IF NOT EXISTS) ولن تحذف أو تكرر أي بيانات موجودة.

-- ── الفروع (Branches) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  address      TEXT,
  phone        TEXT,
  whatsapp     TEXT,
  maps_url     TEXT,
  maps_embed   TEXT,
  working_hours TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS name          TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS address       TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone         TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS whatsapp      TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS maps_url      TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS maps_embed    TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS working_hours TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS sort_order    INT NOT NULL DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT now();
ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

-- ── الخدمات (Services) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT,
  name_ar           TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'shoes',
  description       TEXT,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes  INT NOT NULL DEFAULT 30,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE services ADD COLUMN IF NOT EXISTS name             TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS name_ar          TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS category         TEXT NOT NULL DEFAULT 'shoes';
ALTER TABLE services ADD COLUMN IF NOT EXISTS description      TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price            NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 30;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order       INT NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT now();
ALTER TABLE services ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- ── التقييمات (Reviews) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  service       TEXT,
  order_number  TEXT,
  rating        INT NOT NULL DEFAULT 5,
  text          TEXT,
  is_approved   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS service       TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_number  TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating        INT NOT NULL DEFAULT 5;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS text          TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_approved   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT now();

-- ── الماركات (Brands) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  name_ar    TEXT NOT NULL,
  logo_url   TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS name       TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS name_ar    TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_url   TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ── أوقات العمل (Working Hours) ───────────────────────────
CREATE TABLE IF NOT EXISTS working_hours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week   INT NOT NULL UNIQUE,   -- 0=الأحد ... 6=السبت
  day_name_ar   TEXT,
  is_open       BOOLEAN NOT NULL DEFAULT true,
  open_time     TEXT DEFAULT '09:00',
  close_time    TEXT DEFAULT '18:00',
  slot_duration INT DEFAULT 30,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS day_of_week   INT;
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS day_name_ar   TEXT;
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS is_open       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS open_time     TEXT DEFAULT '09:00';
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS close_time    TEXT DEFAULT '18:00';
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS slot_duration INT DEFAULT 30;
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT now();
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

-- ── إعدادات المتجر (App Settings) ─────────────────────────
-- صف واحد فقط يُستخدم في: Settings, SocialSettings, والصفحة الرئيسية (Footer)
CREATE TABLE IF NOT EXISTS app_settings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name                TEXT,
  phone                    TEXT,
  city                     TEXT,
  address                  TEXT,
  vat_number               TEXT,
  cr_number                TEXT,
  vat_enabled              BOOLEAN DEFAULT true,
  logo_url                 TEXT,
  moyasar_publishable_key  TEXT,
  social_instagram         TEXT,
  social_whatsapp          TEXT,
  social_twitter           TEXT,
  social_snapchat          TEXT,
  social_tiktok            TEXT,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS shop_name               TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS phone                   TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS city                    TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS address                 TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS vat_number              TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS cr_number               TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS vat_enabled             BOOLEAN DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS logo_url                TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS moyasar_publishable_key TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS social_instagram        TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS social_whatsapp         TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS social_twitter          TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS social_snapchat         TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS social_tiktok           TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS created_at              TIMESTAMPTZ DEFAULT now();
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT now();

-- ── الحجوزات (Bookings) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number    TEXT,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  customer_email    TEXT,
  service_id        UUID,
  service_name      TEXT,
  service_price     NUMERIC(10,2),
  booking_date      DATE,
  booking_time      TEXT,
  end_time          TEXT,
  duration_minutes  INT DEFAULT 30,
  booking_type      TEXT DEFAULT 'in_store',   -- in_store | home_visit
  address           TEXT,
  latitude          NUMERIC(10,6),
  longitude         NUMERIC(10,6),
  item_photos       JSONB DEFAULT '[]'::jsonb,
  delivery_fee      NUMERIC(10,2) DEFAULT 0,
  total_price       NUMERIC(10,2),
  status            TEXT DEFAULT 'pending',     -- pending | confirmed | done | cancelled
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number   TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_name    TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone   TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_email   TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_id       UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_price    NUMERIC(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date     DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_time     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time         TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 30;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_type     TEXT DEFAULT 'in_store';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address          TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS latitude         NUMERIC(10,6);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS longitude        NUMERIC(10,6);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS item_photos      JSONB DEFAULT '[]'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_fee     NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price      NUMERIC(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes            TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT now();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- ── فهارس مفيدة ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_services_active     ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_approved    ON reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_brands_sort         ON brands(sort_order);
CREATE INDEX IF NOT EXISTS idx_branches_active     ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_phone      ON bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_number     ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status);

-- ── صف افتراضي واحد لإعدادات المتجر (بحيث تعمل شاشة الإعدادات فوراً) ──
INSERT INTO app_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM app_settings);

-- ── updated_at التلقائي لكل جدول جديد ─────────────────────
-- (الدالة update_updated_at() منشأة مسبقاً في ملف 001_loyalty_wallet.sql؛
--  إذا لم تُنفّذ ذلك الملف بعد نفّذه أولاً، أو أنشئها هنا بأمان)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS branches_updated_at ON branches;
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS working_hours_updated_at ON working_hours;
CREATE TRIGGER working_hours_updated_at BEFORE UPDATE ON working_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── الصلاحيات (RLS) — نفس نمط بقية جداول المشروع ─────────
-- التحقق من الهوية يتم داخل التطبيق عبر PIN وليس Supabase Auth،
-- لذلك نفتح الوصول الكامل على مستوى الجدول (كما في بقية الجداول).
ALTER TABLE branches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands        ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_branches"      ON branches;
DROP POLICY IF EXISTS "service_all_services"      ON services;
DROP POLICY IF EXISTS "service_all_reviews"       ON reviews;
DROP POLICY IF EXISTS "service_all_brands"        ON brands;
DROP POLICY IF EXISTS "service_all_working_hours" ON working_hours;
DROP POLICY IF EXISTS "service_all_app_settings"  ON app_settings;
DROP POLICY IF EXISTS "service_all_bookings"      ON bookings;

CREATE POLICY "service_all_branches"      ON branches      FOR ALL USING (true);
CREATE POLICY "service_all_services"      ON services      FOR ALL USING (true);
CREATE POLICY "service_all_reviews"       ON reviews       FOR ALL USING (true);
CREATE POLICY "service_all_brands"        ON brands        FOR ALL USING (true);
CREATE POLICY "service_all_working_hours" ON working_hours FOR ALL USING (true);
CREATE POLICY "service_all_app_settings"  ON app_settings  FOR ALL USING (true);
CREATE POLICY "service_all_bookings"      ON bookings      FOR ALL USING (true);
