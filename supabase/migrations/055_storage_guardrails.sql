-- حدود حجم الملفات 1MB + تنظيف سجل الزيارات بعد 90 يوم (طُبّق عبر MCP)
update storage.buckets set file_size_limit = 1048576 where id in ('order-photos','shop-products','auction-submissions','branding','brands');
create or replace function public.prune_site_visits() returns void language sql security definer set search_path=public as $$ delete from public.site_visits where created_at < now() - interval '90 days'; $$;
revoke all on function public.prune_site_visits() from public, anon, authenticated;
select cron.schedule('site-visits-prune-weekly','30 2 * * 0','select public.prune_site_visits()');
