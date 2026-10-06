import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { isPublicPath, langOfPath, altPath } from '@/lib/seo/routes';

/**
 * يربط اللغة بالرابط للصفحات العامة:
 *  - تحميل أول / رجوع وأمام بالمتصفح (POP): الرابط هو المرجع → نضبط اللغة عليه.
 *  - ضغط زر اللغة: نحوّل الرابط للنسخة المقابلة (/shop ⇄ /en/shop).
 *  - ضغط رابط داخلي بالنسخة الإنجليزية (يشاور للمسار العربي): نبقى بالإنجليزي.
 */
export default function LangByUrl() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const { lang, forceLang } = useLanguage();
  const prev = useRef({ pathname, lang, first: true });

  useEffect(() => {
    const p = prev.current;
    const pathChanged = p.pathname !== pathname;
    const langChanged = p.lang !== lang;
    const wasFirst = p.first;
    prev.current = { pathname, lang, first: false };

    if (!isPublicPath(pathname)) return;
    const urlLang = langOfPath(pathname);
    if (urlLang === lang) return;

    // navType يبقى 'POP' بعد التحميل الأول حتى أول تنقل — فلا نعتبره رجوعاً إلا لو الرابط فعلاً تغيّر
    if (wasFirst || (pathChanged && navType === 'POP')) { forceLang(urlLang); return; }
    if (langChanged && !pathChanged) { navigate(altPath(pathname, lang)); return; }     // زر اللغة
    if (pathChanged) navigate(altPath(pathname, lang), { replace: true });               // رابط داخلي
  }, [pathname, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
