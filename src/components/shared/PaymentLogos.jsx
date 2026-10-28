import React from 'react';

// شعارات وسائل الدفع بخلفية شفافة (ملفات SVG في /public/images/payments).
// النسخة dark للخلفيات الداكنة (نص أبيض)، والعادية للخلفيات الفاتحة. الشعارات علامات تجارية لأصحابها.
// mastercard وamex صور PNG شفافة بألوانها الأصلية (تصلح للخلفيتين)؛ البقية SVG بنسختين فاتحة/داكنة
const LOGOS = [['mada', 'mada مدى', 'svg'], ['mastercard', 'Mastercard', 'png'], ['visa', 'Visa', 'svg'], ['applepay', 'Apple Pay', 'svg'], ['amex', 'American Express', 'png']];

export default function PaymentLogos({ height = '5.4vh', gap = '1.6vh', label = 'نقبل الدفع عبر', color = '#5a5247', dark = false }) {
  return (
    <div className="flex items-center justify-center flex-wrap" style={{ gap }}>
      {label && <span style={{ fontSize: '1.9vh', color, marginInlineEnd: '.6vh' }}>{label}</span>}
      {LOGOS.map(([f, alt, ext]) => <img key={f} src={`/images/payments/${f}${dark && ext === 'svg' ? '-dark' : ''}.${ext}`} alt={alt} style={{ height: f === 'amex' ? `calc(${height} * 1.15)` : f === 'mastercard' ? `calc(${height} * 1.25)` : height, width: 'auto' }} />)}
    </div>
  );
}
