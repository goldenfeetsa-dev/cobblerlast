-- ============================================================
-- 005_schedule_photo_cleanup.sql
-- يجدول استدعاء دالة cleanup-old-photos تلقائياً كل يوم الساعة 3
-- فجراً (توقيت جرينتش)، لحذف صور الطلبات/الحجوزات التي مضى عليها
-- أكثر من أسبوعين.
--
-- ⚠️ قبل تشغيل هذا الملف:
--   1) انشر الدالة أولاً من جهازك:
--        supabase functions deploy cleanup-old-photos
--   2) اضبط سرّ الحماية (اختر أي نص عشوائي طويل، واحفظه):
--        supabase secrets set CLEANUP_SECRET=ضع-نص-عشوائي-طويل-هنا
--   3) استبدل القيم أدناه بالقيم الحقيقية لمشروعك قبل التشغيل:
--        - <YOUR-PROJECT-REF>   من رابط مشروعك في Supabase (Settings > General)
--        - <YOUR-CLEANUP-SECRET> نفس القيمة اللي ضبطتها بالخطوة 2
--   4) الصق الملف كاملاً في: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- تفعيل الإضافات المطلوبة للجدولة والاتصال بالإنترنت من داخل قاعدة البيانات
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- إزالة أي جدولة سابقة بنفس الاسم (حتى تقدر تعيد التشغيل بأمان)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-old-order-photos';

-- الجدولة الفعلية: كل يوم الساعة 3:00 صباحاً UTC (= 6:00 صباحاً بتوقيت السعودية)
SELECT cron.schedule(
  'cleanup-old-order-photos',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<YOUR-PROJECT-REF>.functions.supabase.co/cleanup-old-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', '<YOUR-CLEANUP-SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- للتأكد أن الجدولة اتسجلت:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-old-order-photos';

-- لمشاهدة سجل آخر مرات التشغيل ونتائجها:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
