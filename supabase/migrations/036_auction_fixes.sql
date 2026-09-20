-- إصلاحات وإضافات سوق المزاد
-- 1) تواريخ انتهاء المزادات الحالية كانت بالماضي (منتهية فعلياً) —
--    سبب عدم قدرة أي زائر على المشاركة/المزايدة
update auction_listings
set ends_at = now() + interval '5 days', starts_at = now()
where status = 'active';

-- 2) صورة "قبل الترميم" (تالفة) كانت محطوطة بالغلط بدل "بعد الترميم"
--    بقطعة الحقيبة الظهرية — تبان كقطعة تالفة/غير جذابة بدل المنتج
--    المجدَّد المعروض فعلياً للبيع
update auction_listings
set image_url = '/images/gallery/bag-after.png',
    before_image_url = '/images/gallery/bag-before.png',
    after_image_url = '/images/gallery/bag-after.png'
where title_ar = 'حقيبة ظهر جلد مجدّدة';

-- 3) أعمدة بيانات مقدّم طلب عرض القطعة (submitter) — عشان فريق العمل
--    يقدر يتواصل مع العميل اللي قدّم قطعته لمراجعتها وتحديد سعر البداية
alter table auction_listings add column if not exists submitter_name text;
alter table auction_listings add column if not exists submitter_phone text;

-- 4) bucket تخزين صور القطع المُقدَّمة من العملاء (نموذج "اعرض قطعتك")
insert into storage.buckets (id, name, public) values ('auction-submissions', 'auction-submissions', true)
on conflict (id) do nothing;

create policy if not exists "public_read_auction_submissions" on storage.objects for select using (bucket_id = 'auction-submissions');
create policy if not exists "anyone_upload_auction_submissions" on storage.objects for insert with check (bucket_id = 'auction-submissions');
