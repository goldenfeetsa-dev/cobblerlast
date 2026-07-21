import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────
// خيط ديناميكي حقيقي — بدل خط ثابت، نبني منحنى Catmull-Rom بين
// نقطة البداية (البكرة) ونقطة النهاية (طرف الإبرة المتحرك)، ونعيد
// بناء الأنبوب (TubeGeometry) كل فريم عشان الخيط "يتحرك ويهتز"
// بدل ما يكون خط مستقيم جامد.
//
// props:
//   start    — [x,y,z] موقع ثابت (البكرة)
//   endRef   — ref لمجموعة Three (طرف الإبرة) نقرأ موضعها العالمي
//              من داخل useFrame كل مرة
//   color    — لون الخيط
//   sag      — مقدار الترهّل/الاهتزاز الإضافي على المنتصف
// ─────────────────────────────────────────────────────────────────
export default function Thread({ start, endRef, color = '#e8e2d0', sag = 0.12 }) {
  const meshRef = useRef();
  const startVec = useRef(new THREE.Vector3(...start));
  const endVec = useRef(new THREE.Vector3(...start));
  const t0 = useRef(Math.random() * 10);

  useEffect(() => {
    return () => {
      // تنظيف الـ geometry عند إزالة المكوّن عشان ما تصير memory leak
      if (meshRef.current?.geometry) meshRef.current.geometry.dispose();
    };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const end = endRef?.current
      ? endRef.current.getWorldPosition(endVec.current)
      : endVec.current.set(...start);

    const t = state.clock.elapsedTime + t0.current;
    const mid = startVec.current.clone().lerp(end, 0.5);
    // ترهّل + اهتزاز خفيف بالمنتصف يحاكي شد وإرخاء الخيط أثناء الغرزة
    mid.y -= sag + Math.sin(t * 3) * 0.02;
    mid.x += Math.sin(t * 2.3) * 0.015;

    const curve = new THREE.CatmullRomCurve3([startVec.current, mid, end]);
    const newGeom = new THREE.TubeGeometry(curve, 14, 0.006, 5, false);

    const old = meshRef.current.geometry;
    meshRef.current.geometry = newGeom;
    if (old) old.dispose();
  });

  return (
    <mesh ref={meshRef}>
      <bufferGeometry />
      <meshStandardMaterial color={color} roughness={0.7} metalness={0} />
    </mesh>
  );
}
