import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import Workshop from './Workshop';
import Shoe from './Shoe';
import RoboticArm from './RoboticArm';
import SpoolRack from './SpoolRack';
import Thread from './Thread';
import { useHeroStore } from '@/lib/hero3d/store';

// ─────────────────────────────────────────────────────────────────
// كاميرا بتحرّك خفيف (parallax) حسب موضع الماوس — منقول من الـ
// store بدل ما نربط مستمعين مباشرة داخل Canvas (أداء أفضل).
// ─────────────────────────────────────────────────────────────────
function CameraRig() {
  const { camera } = useThree();
  const pointer = useHeroStore((s) => s.pointer);
  useFrame(() => {
    camera.position.x += (pointer.x * 0.4 - camera.position.x) * 0.04;
    camera.position.y += (1.2 - pointer.y * 0.25 - camera.position.y) * 0.04;
    camera.lookAt(0, -0.1, 0);
  });
  return null;
}

function SceneContents() {
  const shoeRef = useRef();
  const rightTipRef = useRef();
  const leftTipRef = useRef();

  return (
    <>
      <CameraRig />

      {/* إضاءة دافئة LED من الأعلى + إضاءة تعبئة خفيفة */}
      <ambientLight intensity={0.35} color="#3a2a1a" />
      <pointLight position={[0, 2.4, 1]} intensity={1.4} color="#ffd9a0" distance={8} decay={2} />
      <pointLight position={[-2, 1.5, 1]} intensity={0.5} color="#ffb877" distance={6} decay={2} />
      <spotLight
        position={[0.5, 2.6, 1.5]}
        angle={0.5}
        penumbra={0.6}
        intensity={0.9}
        color="#fff1d6"
        target-position={[0, -0.2, 0]}
      />

      <Workshop />

      <Shoe shoeRef={shoeRef} />

      {/* الذراع اليمنى — الخياطة الفعلية */}
      <RoboticArm side="right" position={[1.15, -0.25, 0.15]} mode="stitch" tipRef={rightTipRef} />
      {/* الذراع اليسرى — مهمة دقيقة (ترميم صغير) */}
      <RoboticArm side="left" position={[-1.15, -0.25, 0.15]} mode="repair" tipRef={leftTipRef} />

      {/* رفوف البكرات على الطرفين */}
      <SpoolRack position={[1.9, -0.1, -0.3]} />
      <SpoolRack position={[-1.9, -0.1, -0.3]} />

      {/* الخيوط الحية: من كل رف نحو طرف الإبرة اليمنى (خياطة فعلية) */}
      <Thread start={[1.9, 0.5, -0.3]} endRef={rightTipRef} color="#e8c88a" sag={0.25} />
      <Thread start={[-1.9, 0.5, -0.3]} endRef={leftTipRef} color="#d9d2bd" sag={0.2} />
    </>
  );
}

export default function Scene({ className = '' }) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <Canvas
        camera={{ position: [0, 1.2, 4.2], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onPointerMove={(e) => {
          const x = (e.clientX / window.innerWidth) * 2 - 1;
          const y = (e.clientY / window.innerHeight) * 2 - 1;
          useHeroStore.getState().setPointer(x, y);
        }}
      >
        <Suspense fallback={null}>
          <SceneContents />
        </Suspense>
      </Canvas>
    </div>
  );
}
