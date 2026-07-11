import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useTrackVisit(page = '/booking') {
  useEffect(() => {
    async function track() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
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
    track();
  }, [page]);
}
