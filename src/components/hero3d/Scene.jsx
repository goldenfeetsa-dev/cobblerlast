import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
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
    camera.position.y += (0.9 - pointer.y * 0.2 - camera.position.y) * 0.04;
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

      {/* إضاءة معاد ضبطها بالكامل — كانت خافتة جداً وما تبيّن أي تفاصيل.
          الآن: تعبئة عامة قوية + إضاءة LED دافئة من الأعلى تصيب الحذاء
          والمكتب مباشرة + إضاءة جانبية من النافذة (باردة قليلاً تقابل
          الدافئ) عشان يصير فيه تباين وعمق بدل سواد مسطّح. */}
      <ambientLight intensity={0.9} color="#5a4530" />
      <hemisphereLight args={['#ffe9c4', '#2a1c10', 0.8]} />

      {/* الإضاءة الرئيسية فوق الحذاء مباشرة */}
      <pointLight position={[0, 2.2, 1.2]} intensity={4.5} color="#ffdca8" distance={10} decay={1.6} />
      <spotLight
        position={[0.2, 2.6, 1.8]}
        angle={0.6}
        penumbra={0.5}
        intensity={5}
        color="#fff2d9"
        distance={9}
        decay={1.4}
        target-position={[0, -0.1, 0]}
      />

      {/* إضاءة تعبئة من جهة النافذة (يسار) — تعطي عمق ولمعان بارد خفيف */}
      <pointLight position={[-2.4, 1.2, 1]} intensity={1.8} color="#a8c8ff" distance={7} decay={1.8} />

      {/* إضاءة تعبئة دافئة من اليمين قرب البكرات */}
      <pointLight position={[2.2, 1, 1]} intensity={1.6} color="#ffb877" distance={7} decay={1.8} />

      {/* إضاءة أمامية خفيفة تجاه الكاميرا عشان الوجه الأمامي للحذاء
          والأذرع ما يطلع أسود بالكامل */}
      <pointLight position={[0, 0.4, 3.5]} intensity={1.2} color="#fff1d6" distance={8} decay={2} />

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
        camera={{ position: [0, 0.9, 5.4], fov: 48 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
        }}
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
