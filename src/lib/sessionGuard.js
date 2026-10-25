// حارس انتهاء الجلسة: كوكي الدخول صالح 12 ساعة. إذا انتهى والواجهة ما زالت تعرض الموظف كمسجّل،
// كل طلبات البيانات ترجع 401 فتظهر الصفحات فارغة. هنا نكتشف ذلك ونعيد المستخدم لصفحة الدخول.
import { getSession, clearSession } from '@/lib/sessionStore';

let handling = false;

function isGuarded(url) {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && (u.pathname.startsWith('/sb/') || u.pathname.startsWith('/api/secure/'));
  } catch { return false; }
}

export function installSessionGuard() {
  if (typeof window === 'undefined' || window.__sessionGuard) return;
  window.__sessionGuard = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await orig(input, init);
    if (res.status === 401 && !handling) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (isGuarded(url) && getSession()) {
        handling = true;
        clearSession();
        try { sessionStorage.setItem('session_expired', '1'); } catch { /* ignore */ }
        window.location.replace('/login');
      }
    }
    return res;
  };
}
