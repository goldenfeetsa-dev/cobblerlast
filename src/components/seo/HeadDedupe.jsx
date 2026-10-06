import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isPublicPath, normalize } from '@/lib/seo/routes';
import { SITE } from '@/lib/seo/siteData';

/**
 * وسوم <head> الثابتة تُحقن وقت البناء (scripts/seo-build.mjs) لتشوفها الزواحف
 * اللي ما تشغّل JavaScript. بعد تشغيل React، react-helmet-async يضيف نسخته
 * (data-rh) من نفس الوسوم → يصير عندنا وصف/canonical/OG مكرر ومتضارب.
 * هذا المكوّن يحذف الوسوم الثابتة فقط حين يكون لها بديل من Helmet.
 */
const SELECTORS = [
  'meta[name="description"]',
  'link[rel="canonical"]',
  'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]',
  'meta[name="twitter:title"]', 'meta[name="twitter:description"]', 'meta[name="twitter:url"]',
];

export default function HeadDedupe() {
  const { pathname } = useLocation();
  useEffect(() => {
    const run = () => {
      // canonical ذاتي المرجع للصفحات العامة (/shop للعربي و/en/shop للإنجليزي) —
      // صفحات React تكتب canonical عربي ثابت، وبدون هذا الإنجليزي يشاور للعربي
      if (isPublicPath(pathname)) {
        const c = document.head.querySelector('link[rel="canonical"][data-rh]') || document.head.querySelector('link[rel="canonical"]');
        const want = SITE.url + (normalize(pathname) === '/' ? '/' : normalize(pathname));
        if (c && c.getAttribute('href') !== want) c.setAttribute('href', want);
      }
      for (const sel of SELECTORS) {
        if (document.head.querySelector(`${sel}[data-rh]`)) {
          document.head.querySelectorAll(`${sel}:not([data-rh])`).forEach((el) => el.remove());
        }
      }
    };
    run();
    // صفحات lazy/ثقيلة (مثل الرئيسية) يضيف Helmet وسومها متأخراً — نراقب تغيّر
    // الـhead ونعيد التنظيف (الحذف لا يسبب حلقة لأن التشغيل التالي لا يجد شيئاً)
    const mo = new MutationObserver(run);
    mo.observe(document.head, { childList: true });
    return () => mo.disconnect();
  }, [pathname]);
  return null;
}
