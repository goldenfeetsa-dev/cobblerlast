-- ══════════════════════════════════════════════════════════
-- برنامج الولاء بالنقاط (Loyalty Membership Program)
-- نظام مستقل عن نظام بطاقات الختم القديم (loyalty_cards/001)
-- يعتمد على: رقم عضوية + نقاط + مستوى عضوية + Apple/Google Wallet
-- ══════════════════════════════════════════════════════════

-- ── جدول أعضاء الولاء ────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID,                            -- ربط اختياري بسجل العميل في جدول customers
  member_number     TEXT NOT NULL UNIQUE,          -- رقم عضوية يُولّد تلقائياً (مثال: NT-A1B2C3D4)
  full_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT NOT NULL UNIQUE,
  points            INT  NOT NULL DEFAULT 0 CHECK (points >= 0),
  membership_level  TEXT NOT NULL DEFAULT 'Bronze'
                      CHECK (membership_level IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
  apple_pass_id     TEXT,                          -- serialNumber الخاص ببطاقة Apple Wallet
  google_object_id  TEXT,                          -- Object ID الخاص ببطاقة Google Wallet
  qr_code           TEXT,                          -- المحتوى المُرمّز داخل QR (وليس صورة)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_members_member_number ON loyalty_members(member_number);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_phone          ON loyalty_members(phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_user_id        ON loyalty_members(user_id);

-- نضيف قيد FK نحو customers فقط إن كان الجدول موجوداً فعلاً بهذا الشكل —
-- بأسلوب آمن لا يُفشل الهجرة على أي بيئة قد يختلف فيها ترتيب الجداول.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'loyalty_members_user_id_fkey' AND table_name = 'loyalty_members'
     )
  THEN
    BEGIN
      ALTER TABLE loyalty_members
        ADD CONSTRAINT loyalty_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES customers(id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      -- تجاهل بأمان إن اختلف نوع العمود أو أي تعارض آخر — العمود يبقى صالحاً بدون القيد
      NULL;
    END;
  END IF;
END $$;

-- ── سجل عمليات النقاط (إضافة/خصم) ────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_points_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  change_amount    INT  NOT NULL,                  -- موجب = إضافة، سالب = خصم
  balance_after    INT  NOT NULL,
  reason           TEXT,
  performed_by     TEXT,                           -- اسم المدير/الموظف الذي نفّذ العملية
  performed_by_id  UUID,                            -- معرف الموظف إن وجد (بدون قيد FK صارم)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_member ON loyalty_points_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created ON loyalty_points_transactions(created_at DESC);

-- ── إشعارات داخل الموقع للعميل عند تغيّر نقاطه ───────────
CREATE TABLE IF NOT EXISTS loyalty_member_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'points_update', -- points_update | level_up | welcome
  message      TEXT NOT NULL,
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_notif_member ON loyalty_member_notifications(member_id);

-- ── إعدادات برنامج الولاء بالنقاط ─────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_membership_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_name              TEXT DEFAULT 'إبرة وخيط — برنامج الولاء',
  brand_color               TEXT DEFAULT '#1A0F00',
  accent_color              TEXT DEFAULT '#C9A84C',
  silver_threshold          INT  DEFAULT 500,
  gold_threshold            INT  DEFAULT 1500,
  platinum_threshold        INT  DEFAULT 3000,
  apple_pass_type_identifier TEXT,                 -- pass.com.yourcompany.loyalty
  apple_team_identifier      TEXT,
  google_issuer_id           TEXT,
  google_loyalty_class_id    TEXT,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO loyalty_membership_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ── updated_at trigger (يعيد استخدام الدالة إن كانت موجودة) ─
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS loyalty_members_updated_at ON loyalty_members;
CREATE TRIGGER loyalty_members_updated_at
  BEFORE UPDATE ON loyalty_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS loyalty_membership_settings_updated_at ON loyalty_membership_settings;
CREATE TRIGGER loyalty_membership_settings_updated_at
  BEFORE UPDATE ON loyalty_membership_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ───────────────────────────────────
ALTER TABLE loyalty_members                ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_member_notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_membership_settings    ENABLE ROW LEVEL SECURITY;

-- القراءة متاحة (تُستخدم من صفحة العميل للبحث عن بطاقته)، أما الكتابة
-- (إنشاء عضو / تعديل نقاط) فتمر حصراً عبر Vercel API functions التي
-- تستخدم SUPABASE_SERVICE_ROLE_KEY، تماماً كما هو معمول به مع ZATCA.
CREATE POLICY "loyalty_members_select"        ON loyalty_members              FOR SELECT USING (true);
CREATE POLICY "loyalty_members_service_write" ON loyalty_members              FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "loyalty_members_service_update" ON loyalty_members             FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "loyalty_members_service_delete" ON loyalty_members             FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "loyalty_tx_select"        ON loyalty_points_transactions       FOR SELECT USING (true);
CREATE POLICY "loyalty_tx_service_write" ON loyalty_points_transactions       FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "loyalty_notif_select"        ON loyalty_member_notifications   FOR SELECT USING (true);
CREATE POLICY "loyalty_notif_service_write" ON loyalty_member_notifications   FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "loyalty_notif_update"        ON loyalty_member_notifications   FOR UPDATE USING (true); -- للسماح بتعليم "مقروء" من واجهة العميل

CREATE POLICY "loyalty_settings_select"        ON loyalty_membership_settings FOR SELECT USING (true);
CREATE POLICY "loyalty_settings_service_write" ON loyalty_membership_settings FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "loyalty_settings_service_update" ON loyalty_membership_settings FOR UPDATE USING (auth.role() = 'service_role');
