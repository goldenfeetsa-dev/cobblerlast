import React from 'react';

// شارة مدى مبسّطة (نص + شريطان بلون الهوية). للاعتماد الرسمي استبدلها بملف الشعار من دليل هوية «مدى» (المدفوعات السعودية).
function Mada({ h }) {
  return (
    <svg viewBox="0 0 750 471" style={{ height: h, width: 'auto' }} role="img" aria-label="mada">
      <rect width="750" height="471" rx="40" fill="#fff" stroke="#d8d4cc" strokeWidth="6" />
      <path d="M90 330 L210 90 L270 90 L150 330Z" fill="#259bd6" />
      <path d="M170 330 L290 90 L350 90 L230 330Z" fill="#84bd00" />
      <text x="560" y="205" textAnchor="middle" fontFamily="Cairo, Tahoma, sans-serif" fontWeight="900" fontSize="150" fill="#1b3a6b">مدى</text>
      <text x="560" y="335" textAnchor="middle" fontFamily="Cairo, Arial, sans-serif" fontWeight="800" fontSize="130" fill="#259bd6">mada</text>
    </svg>
  );
}

export default function PaymentLogos({ height = '5.4vh', gap = '1.6vh', label = 'نقبل الدفع عبر', color = '#5a5247' }) {
  const img = (src, alt) => <img key={alt} src={src} alt={alt} style={{ height, width: 'auto', borderRadius: '.6vh', boxShadow: '0 .2vh .8vh rgba(0,0,0,.18)' }} />;
  return (
    <div className="flex items-center justify-center flex-wrap" style={{ gap }}>
      {label && <span style={{ fontSize: '2.2vh', color, marginInlineEnd: '.6vh' }}>{label}</span>}
      <Mada h={height} />
      {img('/images/payments/mastercard.svg', 'Mastercard')}
      {img('/images/payments/visa.svg', 'Visa')}
      {img('/images/payments/applepay.svg', 'Apple Pay')}
      {img('/images/payments/amex.svg', 'American Express')}
    </div>
  );
}
