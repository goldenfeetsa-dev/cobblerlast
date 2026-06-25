-- ══════════════════════════════════════════════════════════
-- بطاقات الولاء — جداول وـ triggers
-- ══════════════════════════════════════════════════════════

-- ── جدول بطاقات الولاء ──────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone   TEXT NOT NULL UNIQUE,
  customer_name    TEXT NOT NULL,
  stamps           INT  NOT NULL DEFAULT 0,
  free_after       INT  NOT NULL DEFAULT 3,   -- قابل للتغيير من لوحة الإدارة
  total_orders     INT  NOT NULL DEFAULT 0,
  total_spent      NUMERIC(10,2) DEFAULT 0,
  google_object_id TEXT,                       -- Google Wallet object ID
  google_pass_url  TEXT,                       -- رابط إضافة البطاقة
  last_service_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ── جدول سجل الختمات ────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_stamps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id        UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  order_id       TEXT,
  order_number   TEXT,
  service_type   TEXT,
  amount         NUMERIC(10,2),
  stamp_type     TEXT DEFAULT 'earned',  -- earned | redeemed
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── جدول الإشعارات المجدولة ──────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,  -- stamp_earned | free_service | proximity | reminder
  message      TEXT NOT NULL,
  sent_at      TIMESTAMPTZ,
  status       TEXT DEFAULT 'pending',  -- pending | sent | failed
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── إعدادات نظام الولاء ──────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  free_after      INT  NOT NULL DEFAULT 3,
  program_name    TEXT DEFAULT 'إبرة وخيط — بطاقة الولاء',
  brand_color     TEXT DEFAULT '#1A0F00',
  brand_logo_url  TEXT,
  google_issuer_id TEXT,        -- من Google Pay & Wallet Console
  google_class_id  TEXT,        -- Loyalty Class ID
  twilio_sid       TEXT,
  twilio_token     TEXT,
  twilio_from      TEXT,
  notify_on_stamp  BOOLEAN DEFAULT true,
  notify_on_free   BOOLEAN DEFAULT true,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- إدخال إعدادات افتراضية
INSERT INTO loyalty_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ── updated_at trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loyalty_cards_updated_at
  BEFORE UPDATE ON loyalty_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ─────────────────────────────────────────────────
ALTER TABLE loyalty_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_stamps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_settings      ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (Edge Functions use service role)
CREATE POLICY "service_all_loyalty_cards"    ON loyalty_cards         FOR ALL USING (true);
CREATE POLICY "service_all_loyalty_stamps"   ON loyalty_stamps        FOR ALL USING (true);
CREATE POLICY "service_all_loyalty_notifs"   ON loyalty_notifications FOR ALL USING (true);
CREATE POLICY "service_all_loyalty_settings" ON loyalty_settings      FOR ALL USING (true);

-- ── Index للبحث بالجوال ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_phone ON loyalty_cards(customer_phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_stamps_card ON loyalty_stamps(card_id);
