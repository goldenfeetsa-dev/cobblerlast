-- أعمدة منع تكرار الإشعارات: جاهزية الطلب + تذكير الموعد (آمنة للتشغيل أكثر من مرة)
alter table public.orders   add column if not exists ready_notified_at timestamptz;
alter table public.bookings add column if not exists reminder_sent_at  timestamptz;
