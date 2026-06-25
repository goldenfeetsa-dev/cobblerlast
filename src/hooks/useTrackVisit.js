import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useTrackVisit(page = '/booking') {
  useEffect(() => {
    async function track() {
      try {
        // Get geo info from a free public API (no auth needed)
        const geo = await fetch('https://ipapi.co/json/').then(r => r.json()).catch(() => ({}));
        const ua = navigator.userAgent;
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
        
        await base44.entities.SiteVisit.create({
          page,
          country: geo.country_name || geo.country || '',
          city: geo.city || '',
          region: geo.region || '',
          ip: geo.ip ? btoa(geo.ip).slice(0, 16) : '', // hashed for privacy
          user_agent: ua.slice(0, 200),
          referrer: document.referrer.slice(0, 200) || '',
          is_mobile: isMobile,
        });
      } catch (_) {
        // silent fail — never break the page
      }
    }
    track();
  }, [page]);
}