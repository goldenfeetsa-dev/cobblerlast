import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// ─────────────────────────────────────────────────────────────────
// ذراع آلية من النحاس — مبنية بسلسلة Forward-Kinematics بسيطة:
// قاعدة ثابتة -> كتف (يدور) -> مرفق (يدور) -> رسغ/أداة (يدور).
// كل مفصل عبارة عن <group> يلف اللي بعده، فلما ندوّر group الكتف
// كل الذراع (المرفق + الرسغ) تتحرك وياه تلقائياً — نفس فكرة
// الروبوتات الصناعية الحقيقية.
//
// props:
//   side       — 'left' | 'right'، يحدد اتجاه القاعدة والحركة
//   position   — [x,y,z] موقع قاعدة الذراع على المكتب
//   mode       — 'stitch' (يمين: إبرة وخيط) | 'repair' (يسار: مهمة دقيقة)
//   tipRef     — ref فاضي يُمرَّر من الأب، نربطه بنهاية الأداة عشان
//                مكوّن الخيط (Thread) يقدر يتتبع موضعها كل فريم
// ─────────────────────────────────────────────────────────────────
export default function RoboticArm({ side = 'right', position = [0, 0, 0], mode = 'stitch', tipRef }) {
  const shoulderRef = useRef();
  const elbowRef = useRef();
  const wristRef = useRef();
  const phase = useRef(Math.random() * Math.PI * 2);

  const dir = side === 'right' ? -1 : 1; // يمين ينحني نحو المنتصف بإشارة سالبة

  const brass = { color: '#B08D57', metalness: 0.85, roughness: 0.28 };
  const brassDark = { color: '#8a6d3f', metalness: 0.8, roughness: 0.35 };
  const steelJoint = { color: '#3b3530', metalness: 0.6, roughness: 0.4 };

  useFrame((state) => {
    const t = state.clock.elapsedTime + phase.current;

    if (mode === 'stitch') {
      // حركة الغرزة: المرفق يدفع للأمام وللخلف بسرعة أكبر من التعويم
      // العادي، تشبه سحب الخيط في دورة خياطة متكررة (0 -> شد -> رجوع)
      const cycle = (Math.sin(t * 2.2) + 1) / 2; // 0..1
      shoulderRef.current.rotation.z = dir * (0.15 + cycle * 0.12);
      elbowRef.current.rotation.z = dir * (-0.5 + cycle * 0.35);
      wristRef.current.rotation.z = dir * (0.2 - cycle * 0.5);
      wristRef.current.rotation.x = Math.sin(t * 2.2) * 0.12;
    } else {
      // "مهمة دقيقة" على الجانب الأيسر: حركة أبطأ وأدق، أشبه
      // بضغط/تنعيم نقطة صغيرة على جانب الحذاء
      const cycle = (Math.sin(t * 1.1) + 1) / 2;
      shoulderRef.current.rotation.z = dir * (0.1 + cycle * 0.06);
      elbowRef.current.rotation.z = dir * (-0.35 + cycle * 0.15);
      wristRef.current.rotation.z = dir * (0.05 + Math.sin(t * 3) * 0.04);
    }

    // اهتزاز خفيف عمودي يحاكي دقة "الميكرو-تعديل" بالمفصل الأخير
    wristRef.current.position.y = -0.02 + Math.sin(t * 4) * 0.008;
  });

  return (
    <group position={position} rotation={[0, side === 'right' ? -0.3 : 0.3, 0]}>
      {/* القاعدة الثابتة على المكتب */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.12, 16]} />
        <meshStandardMaterial {...steelJoint} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.1, 16]} />
        <meshStandardMaterial {...brassDark} />
      </mesh>

      {/* ── الكتف (يدور) ── */}
      <group ref={shoulderRef} position={[0, 0.1, 0]}>
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial {...steelJoint} />
        </mesh>
        {/* الذراع العلوية */}
        <mesh position={[dir * -0.28, 0.22, 0]} rotation={[0, 0, Math.PI / 2 - dir * 0.5]}>
          <cylinderGeometry args={[0.045, 0.055, 0.55, 12]} />
          <meshStandardMaterial {...brass} />
        </mesh>

        {/* ── المرفق (يدور) — موضوع بنهاية الذراع العلوية ── */}
        <group ref={elbowRef} position={[dir * -0.5, 0.42, 0]}>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial {...steelJoint} />
          </mesh>
          {/* الساعد */}
          <mesh position={[dir * 0.32, 0.1, 0]} rotation={[0, 0, -Math.PI / 2 + dir * 0.3]}>
            <cylinderGeometry args={[0.035, 0.042, 0.48, 12]} />
            <meshStandardMaterial {...brass} />
          </mesh>

          {/* ── الرسغ + الأداة (يدور) ── */}
          <group ref={wristRef} position={[dir * 0.58, 0.22, 0]}>
            <mesh>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial {...steelJoint} />
            </mesh>

            {mode === 'stitch' ? (
              // ── أداة يمين: إبرة رفيعة طويلة ──
              <group ref={tipRef} position={[dir * 0.32, 0, 0]}>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <coneGeometry args={[0.012, 0.5, 8]} />
                  <meshStandardMaterial color="#d9d9d9" metalness={0.9} roughness={0.15} />
                </mesh>
              </group>
            ) : (
              // ── أداة يسار: أداة كبس/تنعيم صغيرة (micro-repair) ──
              <group ref={tipRef} position={[dir * 0.22, 0, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.05, 0.06, 0.16, 12]} />
                  <meshStandardMaterial {...brassDark} />
                </mesh>
                <mesh position={[dir * 0.1, 0, 0]}>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshStandardMaterial color="#c9a84c" metalness={0.7} roughness={0.3} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
