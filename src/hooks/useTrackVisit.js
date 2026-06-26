import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useTrackVisit(page = '/booking') {
  useEffect(() => {
    async function track() {
      try {
        const geo = await fetch('https://ipapi.co/json/').then(r => r.json()).catch(() => ({}));
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
