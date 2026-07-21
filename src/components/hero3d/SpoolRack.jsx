import React from 'react';

// ─────────────────────────────────────────────────────────────────
// رف بكرات الخيط — ثابت تماماً (props.position فقط)، الخيوط
// المتحركة (Thread.jsx) تنطلق من نقطة قريبة من هذا الموقع.
// ─────────────────────────────────────────────────────────────────
export default function SpoolRack({ position = [0, 0, 0] }) {
  const stand = { color: '#4a3323', roughness: 0.6, metalness: 0.1 };
  const spoolColors = ['#c9a84c', '#8a4a3a', '#3a5a4a', '#a8956a'];

  return (
    <group position={position}>
      {/* قاعدة الرف */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.22, 0.06, 0.22]} />
        <meshStandardMaterial {...stand} />
      </mesh>
      {/* عمود الرف */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.9, 8]} />
        <meshStandardMaterial {...stand} />
      </mesh>
      {/* بكرات الخيط الملوّنة مكدّسة */}
      {spoolColors.map((c, i) => (
        <mesh key={i} position={[0, 0.4 + i * 0.14, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.1, 16]} />
          <meshStandardMaterial color={c} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
