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
