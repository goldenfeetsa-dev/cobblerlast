import React from 'react';
import { generateCode128Bars } from '@/lib/barcodeUtils';

export default function BarcodeDisplay({ value, width = 250, height = 60 }) {
  const bars = generateCode128Bars(value);
  const totalUnits = bars.reduce((sum, b) => sum + b.width, 0);
  const unitWidth = width / totalUnits;

  let x = 0;

  return (
    <div className="flex flex-col items-center" style={{ width: '100%', maxWidth: `${width}px` }}>
      {/* width/height هنا نسبة مئوية (متجاوبة) — الشكل الفعلي يُرسم عبر
          viewBox بنفس القيم الأصلية، فالمقاييس الداخلية للأعمدة تبقى
          صحيحة بينما العنصر ككل ينكمش لعرض أي حاوية أضيق (مثل ورق 72مم)
          بدل ما ينقص/يتقطع جزء منه. */}
      <svg width="100%" height="auto" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        {bars.map((bar, i) => {
          const bw = bar.width * unitWidth;
          const rect = bar.black ? (
            <rect key={i} x={x} y={0} width={bw} height={height} fill="black" />
          ) : null;
          x += bw;
          return rect;
        })}
      </svg>
      <p className="text-xs font-mono mt-1 tracking-widest">{value}</p>
    </div>
  );
}