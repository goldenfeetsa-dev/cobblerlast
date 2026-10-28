/// إعدادات الاتصال.
///
/// التطبيق لا يكلّم Supabase بمفتاح مباشر إطلاقاً — يمر بنفس بوابة الموقع
/// (`/api/auth/*` و `/sb/*` و `/api/secure/*`) فتنطبق نفس الصلاحيات ونفس
/// قواعد الحماية على الموقع والجوال. لا يوجد أي سر داخل التطبيق.
///
/// لتجربة نسخة معاينة من Vercel:
///   flutter run --dart-define=API_BASE=https://<preview>.vercel.app
class AppConfig {
  AppConfig._();

  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://www.needlecobbler.com',
  );

  /// اسم كوكي الجلسة الذي يصدره الخادم (api/_lib/session.js).
  static const String sessionCookie = 'nt_session';

  /// الأدوار المسموح لها بالمركز المحاسبي — نفس FINANCE_ROLES في src/lib/roles.js.
  static const Set<String> financeRoles = {'owner', 'admin', 'manager', 'accountant'};

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 35);
}
