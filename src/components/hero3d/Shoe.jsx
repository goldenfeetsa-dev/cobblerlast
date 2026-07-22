import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';

// ─────────────────────────────────────────────────────────────────
// حذاء الأوكسفورد — Placeholder هندسي (بدائيات + RoundedBox) بدل
// موديل GLTF حقيقي. الهيكل هنا مصمم عشان تقدر تستبدل هذا المكوّن
// كامل بـ <primitive object={gltf.scene} /> لاحقاً بدون ما تغيّر
// أي شي بباقي المشهد (كل الأذرع/الخيوط بتشتغل على نفس الـ ref).
//
// props:
//   shoeRef  — ref يُمرَّر من الأب عشان الأذرع والخيوط تعرف
//              وين بالضبط تلتقي بالحذاء (نقطة الخياطة)
// ─────────────────────────────────────────────────────────────────
export default function Shoe({ shoeRef }) {
  const localRef = useRef();
  const ref = shoeRef || localRef;
  const t0 = useRef(Math.random() * 10);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + t0.current;
    // تعويم رأسي ناعم (easing عبر sin) — حوالي 1.2 سم فوق وتحت
    ref.current.position.y = Math.sin(t * 0.6) * 0.06;
    // دوران بطيء ومستمر حول المحور الرأسي
    ref.current.rotation.y = t * 0.18;
  });

  const leather = {
    color: '#8a5230',
    roughness: 0.32,
    metalness: 0.06,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  };
  const sole = {
    color: '#3f2a1c',
    roughness: 0.85,
    metalness: 0,
  };
  const lace = {
    color: '#3a2416',
    roughness: 0.6,
  };

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* النعل */}
      <RoundedBox args={[1.55, 0.14, 0.62]} radius={0.06} smoothness={4} position={[0, -0.32, 0]}>
        <meshStandardMaterial {...sole} />
      </RoundedBox>

      {/* جسم الحذاء الرئيسي */}
      <RoundedBox args={[1.35, 0.42, 0.52]} radius={0.14} smoothness={4} position={[0.02, -0.06, 0]}>
        <meshPhysicalMaterial {...leather} />
      </RoundedBox>

      {/* مقدمة الحذاء (toe cap) — أضيق وأملس */}
      <RoundedBox args={[0.62, 0.34, 0.46]} radius={0.16} smoothness={4} position={[0.68, -0.08, 0]}>
        <meshPhysicalMaterial color="#7a4630" roughness={0.2} metalness={0.1} clearcoat={0.7} clearcoatRoughness={0.2} />
      </RoundedBox>

      {/* كعب الحذاء المرتفع */}
      <RoundedBox args={[0.5, 0.5, 0.5]} radius={0.12} smoothness={4} position={[-0.58, 0.06, 0]}>
        <meshPhysicalMaterial {...leather} />
      </RoundedBox>

      {/* عروة الرباط (eyelet tabs) */}
      {[-0.18, 0.02, 0.22].map((x, i) => (
        <mesh key={i} position={[x, 0.2, 0.22]} rotation={[0, 0, Math.PI / 10]}>
          <boxGeometry args={[0.16, 0.05, 0.04]} />
          <meshStandardMaterial {...lace} />
        </mesh>
      ))}

      {/* شراك بسيطة */}
      <mesh position={[0.02, 0.3, 0.24]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
        <meshStandardMaterial color="#1a1108" roughness={0.8} />
      </mesh>

      {/* نقطة صغيرة مضيئة تمثل مكان الخياطة الجارية على الجانب —
          الذراع اليمنى تستهدف هذه النقطة تقريباً */}
      <mesh position={[0.15, 0.02, 0.27]} visible={false} name="stitchPoint" />
    </group>
  );
}
