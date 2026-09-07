-- فحص أمان شامل — إصلاح تسريب بيانات حرجة
-- ═══════════════════════════════════════════════════════════════
-- 1) employees.pin كان قابل للقراءة من anon مباشرة — يعني نظام
--    الدخول بالـ PIN كان بلا أي معنى أمني فعلياً (أي حد يقرأ كل
--    الأكواد بدون حتى محاولة تسجيل دخول). أُصلح بمنح صلاحية قراءة
--    على أعمدة محددة فقط (بدون pin) بدل الجدول كامل.
revoke select on employees from anon, authenticated;
grant select (id, name, role, branch_id, branch_name, is_active, total_orders, total_revenue, created_at, avatar_url, auth_user_id)
  on employees to anon, authenticated;

-- 2) app_settings فيها أعمدة أسرار حقيقية (zatca_cert, zatca_private_key,
--    twilio_sid, twilio_token) — فاضية حالياً لكن أي تعبئة مستقبلية
--    من شاشة الإعدادات كانت بتصير مكشوفة فوراً لأي زائر بالعالم.
revoke select on app_settings from anon, authenticated;
grant select (
  id, shop_name, vat_number, cr_number, city, address, phone, logo_url,
  vat_enabled, vat_rate, currency, zatca_enabled, zatca_sandbox, zatca_connected,
  moyasar_publishable_key, updated_at,
  social_instagram, social_whatsapp, social_twitter, social_snapchat, social_tiktok,
  google_maps_url, b2b_invoicing_enabled
) on app_settings to anon, authenticated;

-- 3) apple_wallet_registrations (فيها push_token لأجهزة العملاء) —
--    الواجهة الأمامية ما تحتاجه إطلاقاً (يُستخدم من السيرفر فقط)
revoke all on apple_wallet_registrations from anon, authenticated;
