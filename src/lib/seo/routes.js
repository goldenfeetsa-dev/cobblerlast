/**
 * مسارات اللغة: العربي على الجذر (/shop) والإنجليزي بالبادئة /en (/en/shop).
 * لكل لغة رابط مستقل = تفهرسها محركات البحث كصفحتين (hreflang) بدل صفحة
 * وحدة تتبدّل لغتها بـJavaScript (ما تشوفها الزواحف).
 */
const PUBLIC = ['/', '/book', '/shop', '/auction', '/reviews', '/about', '/repair-policy', '/track', '/careers', '/shipping-policy', '/privacy'];

export const isEnPath = (p) => p === '/en' || p.startsWith('/en/');
export const stripEn = (p) => (isEnPath(p) ? (p.slice(3) || '/') : p);
export const normalize = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';
export const isPublicPath = (p) => {
  const b = normalize(stripEn(p));
  return PUBLIC.includes(b) || b.startsWith('/careers/') || b.startsWith('/services/');
};
/** المسار المقابل باللغة الأخرى */
export const altPath = (p, toLang) => {
  const base = normalize(stripEn(p));
  if (toLang === 'en') return base === '/' ? '/en' : '/en' + base;
  return base;
};
export const langOfPath = (p) => (isEnPath(p) ? 'en' : 'ar');
