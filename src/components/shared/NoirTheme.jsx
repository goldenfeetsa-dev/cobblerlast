import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// الثيم الليلي لصفحات الزوار فقط (نظام الكاشير/الإدارة يبقى كما هو).
// قائمة بيضاء صريحة — نفس منطق السكربت المضمّن بـ index.html لتفادي وميض الخلفية.
const PUBLIC_RE = /^\/(booking|book|my-bookings|my-loyalty|reviews|shop|auction|repair-policy|about|privacy|shipping-policy|careers|track|partner|services|areas)(\/|$)/;

export default function NoirTheme() {
  const { pathname } = useLocation();
  useEffect(() => {
    const p = pathname.replace(/^\/en(\/|$)/, '/');
    const pub = p === '/' || PUBLIC_RE.test(p);
    document.documentElement.classList.toggle('noir', pub);
  }, [pathname]);
  return null;
}
