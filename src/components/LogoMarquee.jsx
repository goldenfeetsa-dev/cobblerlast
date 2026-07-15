import React from 'react';

/**
 * LogoMarquee — شريط شعارات متحرك بلا نهاية (Infinite CSS Marquee)
 * ─────────────────────────────────────────────────────────────
 * - حركة مستمرة وسلسة بالكامل عبر CSS (transform + keyframes) —
 *   بدون أي جافاسكربت أثناء الحركة نفسها، فتبقى الأداء ممتاز.
 * - الخداع البصري للحلقة اللانهائية: نكرر قائمة الشعارات مرتين
 *   بالضبط داخل نفس الصف (flex)، ونحرّك بمقدار -50% فقط، فلما توصل
 *   نهاية النسخة الأولى تكون النسخة الثانية طبق الأصل مكانها تماماً.
 * - Pause on hover عبر animation-play-state: paused على :hover.
 * - flexbox لتوزيع متساوٍ (gap ثابت) بدون فجوات غير منتظمة.
 * - Responsive: حجم الشعار والمسافة والسرعة تتغيّر بـ media query.
 */
export default function LogoMarquee({ items = [], speed = 32 }) {
  const doubled = [...items, ...items]; // تكرار مطابق تماماً — أساس الحلقة اللانهائية

  return (
    <div className="logo-marquee">
      <div className="logo-marquee__track" style={{ animationDuration: `${speed}s` }}>
        {doubled.map((b, i) => (
          <div className="logo-marquee__item" key={i} aria-hidden={i >= items.length}>
            {b.logo_url ? (
              <img src={b.logo_url} alt={b.name_ar || b.name || ''} loading="lazy" />
            ) : (
              <span>{b.name_ar || b.name}</span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .logo-marquee {
          overflow: hidden;
          width: 100%;
          -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
          mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
        }

        .logo-marquee__track {
          display: flex;
          align-items: center;
          width: max-content;
          gap: 3.5rem;
          animation-name: logo-marquee-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }

        /* Pause on hover — يتوقف الشريط عند تمرير الفأرة، يستأنف عند إبعادها */
        .logo-marquee:hover .logo-marquee__track {
          animation-play-state: paused;
        }

        .logo-marquee__item {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 96px;
          padding: 0 0.5rem;
        }

        .logo-marquee__item img {
          max-height: 100%;
          max-width: 150px;
          object-fit: contain;
          filter: grayscale(15%) brightness(1.05);
          transition: filter 0.25s ease, transform 0.25s ease;
        }

        .logo-marquee__item:hover img {
          filter: grayscale(0%) brightness(1.15);
          transform: translateY(-2px);
        }

        .logo-marquee__item span {
          font-weight: 900;
          font-size: 1.1rem;
          white-space: nowrap;
          color: rgba(245, 237, 216, 0.6);
        }

        @keyframes logo-marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        /* Responsive — شعارات أصغر ومسافات أضيق وسرعة أخف على الجوال */
        @media (max-width: 768px) {
          .logo-marquee__track { gap: 2rem; animation-duration: 20s !important; }
          .logo-marquee__item { height: 64px; padding: 0 0.25rem; }
          .logo-marquee__item img { max-width: 100px; }
          .logo-marquee__item span { font-size: 0.9rem; }
        }

        /* من يفضّل تقليل الحركة — نوقف الأنيميشن احتراماً لإعدادات النظام */
        @media (prefers-reduced-motion: reduce) {
          .logo-marquee__track { animation: none; }
        }
      `}</style>
    </div>
  );
}
