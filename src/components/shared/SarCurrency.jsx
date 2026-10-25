import React from 'react';

/**
 * الرمز الرسمي الجديد للريال السعودي (اعتمده الملك سلمان فبراير 2025) —
 * بدل نص "ر.س" النصي. حسب إرشادات ساما الرسمية: الرمز يوضع *قبل* الرقم
 * (يسار الرقم) مع مسافة بينهما.
 *
 * الاستخدام: <SarAmount value={order.total_price} /> يطبع "⟨رمز⟩ 125.00"
 * أو <SarSymbol /> لوحده لو احتجت الرمز بمكان مخصص بدون رقم.
 */
export function SarSymbol({ style, className = '' }) {
  return <i className={`sar-symbol ${className}`} style={style} aria-label="ريال سعودي" />;
}

export function SarAmount({ value, decimals = 2, style, className = '', symbolStyle }) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', ...style }} dir="ltr">
      <SarSymbol style={symbolStyle} />
      {num.toFixed(decimals)}
    </span>
  );
}

// يحوّل أي "80 ر.س" / "50 ريال" / "30 SAR" داخل نص عادي إلى رمز الريال الرسمي + الرقم.
// الاستخدام: <RiyalText text="من 80 ر.س" />  أو  <RiyalText>{string}</RiyalText>
const SAR_RE = /((?:\d[\d.,٠-٩٬]*)\s*(?:ر\.\s?س|ريال(?:اً|ات)?|SAR|SR)|(?:ر\.\s?س|SAR))/g;
export function RiyalText({ text, children }) {
  const str = typeof (text ?? children) === 'string' ? (text ?? children) : null;
  if (str == null) return <>{text ?? children}</>;
  const parts = str.split(SAR_RE);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <React.Fragment key={i}>{p}</React.Fragment>;
        const num = p.match(/^\d[\d.,٠-٩٬]*/);
        return (
          <span key={i} dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
            <SarSymbol />{num ? num[0] : ''}
          </span>
        );
      })}
    </>
  );
}
