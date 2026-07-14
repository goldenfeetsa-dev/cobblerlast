-- ─────────────────────────────────────────────────────────────────
-- 014: يصلح مشكلتين جذريتين اكتُشفتا أثناء التشخيص:
--
-- (أ) working_hours: الجدول الأصلي (من قبل هذا المشروع) كان فيه عمود
--     قديم اسمه "day" NOT NULL بدون قيمة افتراضية. لما هجرنا الكود
--     لعمود day_of_week، صار كل INSERT/UPDATE من صفحة "أوقات العمل"
--     يفشل بالخطأ:
--       null value in column "day" of relation "working_hours"
--       violates not-null constraint
--     لأن الكود ما يعرف بوجود عمود "day" أصلاً فما يرسل له قيمة.
--     الحل: نخلي day متزامن تلقائياً مع day_of_week (trigger)
--     ونشيل قيد NOT NULL منه احتياطاً — بدون ما نكسر أي كود قديم
--     يعتمد عليه.
--
-- (ب) صلاحيات RLS: جداول أساسية مثل orders/customers/sales_invoices/
--     employees... تم إنشاؤها خارج ملفات الهجرة هذي (قبل ما نبدأ
--     نكتبها)، ونظام الدخول بالتطبيق كامل مبني على PIN مخصص
--     (session في localStorage) وليس Supabase Auth الحقيقي — يعني
--     كل الطلبات تروح لسوبابيس بصفة anon. فإذا كانت هذي الجداول
--     محكومة بسياسة افتراضية تشترط auth.role() = 'authenticated'
--     (أو ما فيها سياسة SELECT مفتوحة أصلاً)، فكل استعلام يرجع
--     صفوف فاضية بصمت تام (RLS ما يرمي خطأ، يفلتر النتائج فقط) —
--     وهذا يفسر تماماً: لوحة التحكم بدون أرقام، صفحة الطلبات فاضية،
--     العملاء ما يطلعون... الخ رغم إن البيانات موجودة فعلياً.
--     الحل: نطبّق نفس نمط السياسة المفتوحة المستخدم أصلاً بباقي
--     الجداول بهذا المشروع (USING (true)) — لأن الحماية الحقيقية
--     مطبّقة أصلاً على مستوى التطبيق (الأدوار/الصلاحيات بالواجهة)
--     وليس على مستوى قاعدة البيانات.
-- ─────────────────────────────────────────────────────────────────

-- ── (أ) working_hours: تعامل آمن مع عمود "day" القديم ──────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'working_hours' AND column_name = 'day'
  ) THEN
    -- يشيل قيد الإلزام حتى لو الكود الحالي ما يرسل قيمة لهذا العمود
    EXECUTE 'ALTER TABLE working_hours ALTER COLUMN day DROP NOT NULL';

    -- يعبّي القيم الفاضية الحالية من day_of_week إن وجدت
    EXECUTE 'UPDATE working_hours SET day = day_of_week WHERE day IS NULL AND day_of_week IS NOT NULL';
  END IF;
END $$;

-- Trigger يخلي day = day_of_week تلقائياً بأي إدراج/تعديل مستقبلي،
-- عشان أي تقرير أو استعلام قديم يعتمد على عمود "day" يستمر يشتغل
CREATE OR REPLACE FUNCTION sync_working_hours_day()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'working_hours' AND column_name = 'day'
  ) THEN
    NEW.day := NEW.day_of_week;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_working_hours_day ON working_hours;
CREATE TRIGGER trg_sync_working_hours_day
  BEFORE INSERT OR UPDATE ON working_hours
  FOR EACH ROW EXECUTE FUNCTION sync_working_hours_day();

-- ── (ب) سياسات RLS مفتوحة لكل الجداول الأساسية المستخدمة بالتطبيق ──
-- (نفس نمط "service_all_*" المستخدم أصلاً بملف 001 و 003)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders', 'customers', 'employees', 'sales_invoices', 'expenses',
    'audit_logs', 'inventory_items', 'suppliers', 'supplier_products',
    'products', 'stock_movements', 'workshop_custodies', 'workshop_settlements',
    'operations_plans', 'workflow_stages', 'site_visits', 'shop_settings'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_all_%s" ON %I', t, t);
      EXECUTE format('CREATE POLICY "service_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END IF;
  END LOOP;
END $$;
