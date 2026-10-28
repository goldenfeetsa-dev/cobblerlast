import React from 'react';

// شعارات وسائل الدفع بخلفية شفافة (ملفات SVG في /public/images/payments).
// النسخة dark للخلفيات الداكنة (نص أبيض)، والعادية للخلفيات الفاتحة. الشعارات علامات تجارية لأصحابها.
const LOGOS = [['mada', 'mada مدى'], ['mastercard', 'Mastercard'], ['visa', 'Visa'], ['applepay', 'Apple Pay'], ['amex', 'American Express']];

export default function PaymentLogos({ height = '5.4vh', gap = '2.4vh', label = 'نقبل الدفع عبر', color = '#5a5247', dark = false }) {
  return (
    <div className="flex items-center justify-center flex-wrap" style={{ gap }}>
      {label && <span style={{ fontSize: '2.2vh', color, marginInlineEnd: '.6vh' }}>{label}</span>}
      {LOGOS.map(([f, alt]) => <img key={f} src={`/images/payments/${f}${dark ? '-dark' : ''}.svg`} alt={alt} style={{ height, width: 'auto' }} />)}
    </div>
  );
}
