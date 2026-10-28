import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * إحصاء زيارات مجهول الهوية: لا نجمع عنوان IP ولا نرسل شيئاً لأي طرف خارجي
 * (كان يُستدعى ipapi.co ويُخزَّن IP مشفّراً بشكل قابل للعكس — أُوقف لأنه بيانات شخصية بنظام حماية البيانات PDPL).
 * نحفظ فقط: الصفحة، نوع الجهاز، المرجع.
 */
export function useTrackVisit(page = '/booking') {
  useEffect(() => {
    const track = async () => {
      try {
        const ua = navigator.userAgent;
        await supabase.from('site_visits').insert({
          page,
          country: '', city: '', ip: '',
          user_agent: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop',
          referrer: (document.referrer ? new URL(document.referrer).origin : '').slice(0, 120),
          is_mobile: /Mobi|Android|iPhone|iPad/i.test(ua),
        });
      } catch { /* silent */ }
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(track, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(track, 500);
    return () => clearTimeout(t);
  }, [page]);
}
