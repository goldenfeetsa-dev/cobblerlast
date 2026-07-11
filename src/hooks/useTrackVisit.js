import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useTrackVisit(page = '/booking') {
  useEffect(() => {
    async function track() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const geo = await fetch('https://ipapi.co/json/', { signal: controller.signal })
          .then(r => r.json())
          .catch(() => ({}))
          .finally(() => clearTimeout(timeoutId));
        const ua  = navigator.userAgent;
        await supabase.from('site_visits').insert({
          page,
          country:    geo.country_name || '',
          city:       geo.city || '',
          ip:         geo.ip ? btoa(geo.ip).slice(0, 16) : '',
          user_agent: ua.slice(0, 200),
          referrer:   document.referrer.slice(0, 200) || '',
          is_mobile:  /Mobi|Android|iPhone|iPad/i.test(ua),
        });
      } catch { /* silent */ }
    }

    // نؤجل استدعاء خدمة تحديد الموقع الخارجية (ipapi.co) حتى تصبح الصفحة جاهزة للتفاعل،
    // حتى لا تتنافس مع تحميل الصفحة الرئيسية على الشبكة (كانت أحد أسباب البطء).
    // كما أن بعض المتصفحات/الإضافات (مانعات الإعلانات، حماية التتبع في Chrome) تحظر
    // نطاق ipapi.co أحياناً — الكود هنا يتعامل مع ذلك بصمت دون التأثير على عرض الصفحة.
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(track, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(track, 500);
    return () => clearTimeout(t);
  }, [page]);
}
