// ─────────────────────────────────────────────────────────────────
// نظام صلاحيات موحّد — مصدر واحد للحقيقة (Single Source of Truth)
// ─────────────────────────────────────────────────────────────────
// المشكلة اللي كانت موجودة: كل صفحة تقريباً كانت تعرّف قائمة أدوار
// خاصة فيها (['admin','owner','manager']) وبعضها ناسي يضيف 'accountant'
// فتفتح الصفحة عند واحد وتنقفل عند الثاني رغم إنهم بنفس المستوى تقريباً.
// الحل: كل الصفحات تستورد من هنا فقط، وأي تعديل مستقبلي بمكان وحد.

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  ACCOUNTANT: 'accountant',
  CASHIER: 'cashier',
  STAFF: 'staff', // العامل (الإسكافي/الفني)
};

// إدارة كاملة — يشوفون كل شي بدون استثناء
export const FULL_ADMIN_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER];

// إدارة كاملة + محاسب — يشوفون التقارير المالية وزاتكا والفواتير
export const FINANCE_ROLES = [...FULL_ADMIN_ROLES, ROLES.ACCOUNTANT];

export function isFullAdmin(role) {
  return FULL_ADMIN_ROLES.includes(role);
}

// هل يقدر يشوف التقارير المالية / زاتكا / الفواتير؟
export function isFinanceUser(role) {
  return FINANCE_ROLES.includes(role);
}

export function isCashier(role) {
  return role === ROLES.CASHIER;
}

export function isWorker(role) {
  return role === ROLES.STAFF;
}

// أي مستخدم عنده وصول محدود (مو إدارة كاملة ومو محاسب)
export function isRestrictedRole(role) {
  return isCashier(role) || isWorker(role);
}

// الصفحة الافتراضية بعد تسجيل الدخول حسب الدور
export function getHomePath(role) {
  if (isWorker(role)) return '/staff';
  if (isCashier(role)) return '/new-order';
  return '/pos';
}

// الصفحات المسموح للعامل (staff) الدخول عليها فقط — شغله اليومي بدون بيانات إدارية
export const WORKER_ALLOWED_PREFIXES = ['/staff', '/scan', '/orders', '/calendar'];

// الصفحات الممنوعة عن الكاشير (إدارة/تقارير/إعدادات) — كل الباقي مسموح له
export const CASHIER_DENIED_PREFIXES = [
  '/pos', '/employees', '/leaderboard', '/financial-reports', '/audit',
  '/site-analytics', '/admin', '/zatca', '/social-settings', '/settings',
  '/operations', '/staff',
];
