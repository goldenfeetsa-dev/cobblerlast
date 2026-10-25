import React from 'react';
import CleanLogo from './CleanLogo';

/**
 * LogoMarquee — شريط شعارات ثابت (بدون حركة) بخلفية شفافة بالكامل
 * ─────────────────────────────────────────────────────────────
 * طلب صريح: إلغاء الحركة/التمرير التلقائي (كان مزعج)، وخلفية شفافة
 * تماماً لكل شعار حتى لو صغر حجمه، عشان كل الشعارات تنعرض بشكل موحّد
 * ونظيف بدون أي قصّ أو تكدّس.
 */
export default function LogoMarquee({ items = [] }) {
  return (
    <div className="logo-marquee">
      <div className="logo-marquee__track">
        {items.map((b, i) => (
          <div className="logo-marquee__item" key={i}>
            {b.logo_url ? (
              <CleanLogo src={b.logo_url} alt={b.name_ar || b.name || ''} />
            ) : (
              <span>{b.name_ar || b.name}</span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .logo-marquee {
          overflow-x: auto;
          overflow-y: hidden;
          width: 100%;
        }

        .logo-marquee__track {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          flex-wrap: wrap;
          width: 100%;
          gap: 2.5rem;
        }

        .logo-marquee__item {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 64px;
          width: 120px;
          padding: 0;
          background: transparent;
        }

        .logo-marquee__item img {
          max-height: 100%;
          max-width: 100%;
          object-fit: contain;
          background: transparent;
          opacity: .85;
          transition: filter 0.25s ease, transform 0.25s ease;
        }

        .logo-marquee__item:hover img {
          opacity: 1;
          transform: translateY(-2px);
        }

        .logo-marquee__item span {
          font-weight: 900;
          font-size: 1rem;
          white-space: nowrap;
          color: rgba(236, 232, 223, 0.7);
        }

        @media (max-width: 768px) {
          .logo-marquee__track { gap: 1.5rem; }
          .logo-marquee__item { height: 44px; width: 76px; }
          .logo-marquee__item span { font-size: 0.85rem; }
        }
      `}</style>
    </div>
  );
}
