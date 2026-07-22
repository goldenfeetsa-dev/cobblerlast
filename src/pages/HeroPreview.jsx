import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Scene from '@/components/hero3d/Scene';
import HeroOverlayUI from '@/components/hero3d/HeroOverlayUI';

// ─────────────────────────────────────────────────────────────────
// صفحة معاينة مستقلة لهيرو الورشة ثلاثي الأبعاد — على /hero-preview
// فقط، ولا تلمس الصفحة الرئيسية الحالية (BookingLanding) إطلاقاً.
// إذا عجبك التصميم بعدين نقرر مكانه النهائي بالموقع.
// ─────────────────────────────────────────────────────────────────
export default function HeroPreview() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: '100dvh', background: 'radial-gradient(ellipse at 50% 25%, #4a3320 0%, #2a1c12 55%, #180f09 100%)' }}
    >
      {/* رابط رجوع صغير — للمعاينة فقط، مو جزء من التصميم النهائي */}
      <Link
        to="/"
        className="absolute top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold pointer-events-auto"
        style={{ background: 'rgba(0,0,0,0.4)', color: '#EDE4D0', border: '1px solid rgba(237,228,208,0.15)' }}
      >
        <ArrowRight className="w-3 h-3" />
        رجوع للموقع
      </Link>

      <Scene />
      <HeroOverlayUI />
    </section>
  );
}
