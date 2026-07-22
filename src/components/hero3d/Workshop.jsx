import React, { useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────
// غرفة الورشة — خشب داكن فاخر + مكتب بأرجل نحاسية + سجادة + إطار
// نافذة مذهّب يكشف عن أفق الرياض (مبسّط ومستوحى، مو صورة حقيقية
// ولا نسخة طبق الأصل من أي مبنى) عند الغسق.
// ─────────────────────────────────────────────────────────────────

// ── برج مستوحى من شكل "ساقين متطاولتين تتلاقيان بجسر مقوّس
//    وفراغ كبير أسفله" (ملمح الشكل الشهير لبرج المملكة) — مبني من
//    مقاطع مخروطية متدرجة (مو نسخة معمارية دقيقة، تقريب أسلوبي فقط) ──
function TwinTower({ position, scale = 1 }) {
  const glass = { color: '#151024', roughness: 0.18, metalness: 0.55, emissive: '#1a1830', emissiveIntensity: 0.2 };

  // كل ساق مبنية من 3 مقاطع متدرجة تضيق كل ما ارتفعنا — يعطي
  // إحساس تدرّج معماري بدل عمود مربّع جامد
  const legSegments = [
    { y: 0.35, h: 0.7, rB: 0.075, rT: 0.062 },
    { y: 0.95, h: 0.5, rB: 0.062, rT: 0.05 },
    { y: 1.42, h: 0.44, rB: 0.05, rT: 0.036 },
  ];

  const Leg = ({ x }) => (
    <group position={[x, 0, 0]}>
      {legSegments.map((s, i) => (
        <mesh key={i} position={[0, s.y, 0]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[s.rT, s.rB, s.h, 4]} />
          <meshStandardMaterial {...glass} />
        </mesh>
      ))}
    </group>
  );

  return (
    <group position={position} scale={scale}>
      <Leg x={-0.095} />
      <Leg x={0.095} />

      {/* الجسر المقوّس اللي يصل الساقين ويرسم الفراغ المميّز أسفله */}
      <mesh position={[0, 1.68, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.095, 0.028, 8, 16, Math.PI]} />
        <meshStandardMaterial {...glass} />
      </mesh>

      {/* غطاء علوي مدبب فوق الجسر */}
      <mesh position={[0, 1.82, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.012, 0.05, 0.16, 4]} />
        <meshStandardMaterial {...glass} />
      </mesh>

      {/* شرائط نوافذ مضيئة أفقية تلف الساقين — تعطي إحساس واجهة زجاجية حقيقية */}
      {Array.from({ length: 16 }).map((_, i) => {
        const y = 0.08 + i * 0.1;
        const side = i % 2 ? 0.095 : -0.095;
        return (
          <mesh key={i} position={[side, y, 0.05]}>
            <planeGeometry args={[0.1, 0.02]} />
            <meshBasicMaterial color="#f4c97a" transparent opacity={0.75 + Math.sin(i) * 0.15} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── برج مستوحى من شكل "مسلّة رفيعة متدرجة بكرة ذهبية قرب القمة"
//    (ملمح شكل برج الفيصلية) — تقريب أسلوبي عبر مقاطع مخروطية ──
function SpireTower({ position, scale = 1 }) {
  const glass = { color: '#171128', roughness: 0.2, metalness: 0.5, emissive: '#1a1830', emissiveIntensity: 0.15 };

  const segments = [
    { y: 0.4, h: 0.8, rB: 0.19, rT: 0.15 },
    { y: 1.05, h: 0.5, rB: 0.15, rT: 0.1 },
    { y: 1.42, h: 0.24, rB: 0.1, rT: 0.06 },
    { y: 1.6, h: 0.12, rB: 0.06, rT: 0.025 },
  ];

  return (
    <group position={position} scale={scale}>
      {segments.map((s, i) => (
        <mesh key={i} position={[0, s.y, 0]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[s.rT, s.rB, s.h, 4]} />
          <meshStandardMaterial {...glass} />
        </mesh>
      ))}

      {/* الكرة الذهبية المميزة قرب القمة */}
      <mesh position={[0, 1.68, 0]}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshStandardMaterial color="#e8c76a" metalness={0.85} roughness={0.2} emissive="#c9a84c" emissiveIntensity={0.45} />
      </mesh>
      {/* رمح رفيع فوق الكرة */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.004, 0.008, 0.16, 6]} />
        <meshStandardMaterial color="#d9d9d9" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* شرائط نوافذ رأسية تلف الجسم */}
      {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((rot, side) =>
        Array.from({ length: 10 }).map((_, i) => (
          <mesh
            key={`${side}-${i}`}
            position={[Math.sin(rot) * 0.16, 0.15 + i * 0.13, Math.cos(rot) * 0.16]}
            rotation={[0, rot, 0]}
          >
            <planeGeometry args={[0.03, 0.04]} />
            <meshBasicMaterial color="#f4c97a" transparent opacity={0.7} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Skyline() {
  // مباني ثانوية عشوائية تملأ باقي الأفق حول المعلمين الرئيسيين
  const buildings = useMemo(() => {
    const arr = [];
    let x = -3.4;
    while (x < 3.4) {
      const w = 0.22 + Math.random() * 0.3;
      // نتفادى منطقتي المعلمين عشان ما نتراكب فوقهم
      const nearLandmark = (x > -0.55 && x < -0.05) || (x > 0.35 && x < 0.85);
      if (!nearLandmark) {
        const h = 0.5 + Math.random() * 1.4;
        arr.push({ x, w, h, windows: Math.max(2, Math.floor(h * 5)) });
      }
      x += w + 0.06;
    }
    return arr;
  }, []);

  return (
    <group position={[0, -0.2, -0.05]}>
      {/* سماء الغسق */}
      <mesh position={[0, 1, -0.5]}>
        <planeGeometry args={[8, 5]} />
        <meshBasicMaterial color="#241a3d" />
      </mesh>
      {/* توهج الغروب قرب الأفق */}
      <mesh position={[0, 0.2, -0.4]}>
        <planeGeometry args={[8, 1.6]} />
        <meshBasicMaterial color="#c9743a" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0.3, 0.45, -0.35]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#ffcf8a" transparent opacity={0.5} />
      </mesh>

      {/* معلمان مستوحيان من أفق الرياض */}
      <TwinTower position={[-0.3, 0, 0]} scale={1.05} />
      <SpireTower position={[0.6, 0, -0.1]} scale={0.95} />

      {/* مباني عادية تملأ باقي الأفق */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, 0]}>
          <mesh>
            <boxGeometry args={[b.w, b.h, 0.2]} />
            <meshStandardMaterial color="#171025" roughness={0.9} />
          </mesh>
          {Array.from({ length: b.windows }).map((_, wI) => (
            <mesh
              key={wI}
              position={[
                (Math.random() - 0.5) * (b.w * 0.6),
                -b.h / 2 + 0.15 + wI * (b.h / b.windows),
                0.11,
              ]}
            >
              <planeGeometry args={[0.03, 0.045]} />
              <meshBasicMaterial color="#f4c97a" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function Workshop() {
  const woodDark = { color: '#3a281a', roughness: 0.7, metalness: 0.05 };
  const woodPanel = { color: '#4a3320', roughness: 0.55, metalness: 0.05 };
  const deskTop = { color: '#4a3320', roughness: 0.3, metalness: 0.15 };
  const brass = { color: '#c9a84c', roughness: 0.3, metalness: 0.85 };
  const brassDark = { color: '#a8863c', roughness: 0.35, metalness: 0.8 };

  return (
    <group>
      {/* الأرضية */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial {...woodDark} />
      </mesh>

      {/* سجادة فاخرة تحت المكتب */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.04, 0.3]}>
        <planeGeometry args={[3.2, 2]} />
        <meshStandardMaterial color="#3a1418" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.038, 0.3]}>
        <ringGeometry args={[1.42, 1.5, 4]} />
        <meshStandardMaterial color="#c9a84c" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* الجدار الخلفي (لوح خشبي داكن) */}
      <mesh position={[0, 1, -1.6]}>
        <planeGeometry args={[7, 4.5]} />
        <meshStandardMaterial {...woodPanel} />
      </mesh>

      {/* لوحات إضاءة سقفية ظاهرة (LED) */}
      {[-0.9, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 2.55, 0.8]}>
          <boxGeometry args={[1.1, 0.05, 0.35]} />
          <meshStandardMaterial color="#fff1d6" emissive="#ffedc2" emissiveIntensity={1.4} />
        </mesh>
      ))}

      {/* إطار النافذة الكبيرة على اليسار — بإطار خشبي + حافة ذهبية داخلية */}
      <group position={[-2.3, 0.9, -1.55]}>
        <Skyline />
        <mesh position={[0, 2.1, 0.02]}>
          <boxGeometry args={[3.4, 0.12, 0.08]} />
          <meshStandardMaterial {...woodPanel} />
        </mesh>
        <mesh position={[0, 2.02, 0.05]}>
          <boxGeometry args={[3.4, 0.02, 0.02]} />
          <meshStandardMaterial {...brass} />
        </mesh>
        <mesh position={[0, -2.1, 0.02]}>
          <boxGeometry args={[3.4, 0.12, 0.08]} />
          <meshStandardMaterial {...woodPanel} />
        </mesh>
        <mesh position={[0, -2.02, 0.05]}>
          <boxGeometry args={[3.4, 0.02, 0.02]} />
          <meshStandardMaterial {...brass} />
        </mesh>
        <mesh position={[-1.65, 0, 0.02]}>
          <boxGeometry args={[0.12, 4.2, 0.08]} />
          <meshStandardMaterial {...woodPanel} />
        </mesh>
        <mesh position={[1.65, 0, 0.02]}>
          <boxGeometry args={[0.12, 4.2, 0.08]} />
          <meshStandardMaterial {...woodPanel} />
        </mesh>
        <mesh position={[1.57, 0, 0.05]}>
          <boxGeometry args={[0.02, 4.2, 0.02]} />
          <meshStandardMaterial {...brass} />
        </mesh>
      </group>

      {/* المكتب — سطح جلدي داكن بحافة ذهبية وأرجل نحاسية نحيلة */}
      <mesh position={[0, -0.62, 0]}>
        <boxGeometry args={[4.2, 0.08, 1.6]} />
        <meshStandardMaterial {...deskTop} />
      </mesh>
      {/* حافة ذهبية رفيعة حول المكتب */}
      <mesh position={[0, -0.585, 0.8]}>
        <boxGeometry args={[4.2, 0.015, 0.02]} />
        <meshStandardMaterial {...brass} />
      </mesh>
      <mesh position={[0, -0.585, -0.8]}>
        <boxGeometry args={[4.2, 0.015, 0.02]} />
        <meshStandardMaterial {...brass} />
      </mesh>
      {/* أرجل نحاسية نحيلة */}
      {[
        [-1.95, -1.55],
        [1.95, -1.55],
        [-1.95, 0.6],
        [1.95, 0.6],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.85, z]}>
          <cylinderGeometry args={[0.02, 0.025, 0.42, 8]} />
          <meshStandardMaterial {...brassDark} />
        </mesh>
      ))}

      {/* أدوات صغيرة متناثرة على المكتب */}
      {[
        [-0.9, -0.56, 0.35, 0.05],
        [1.1, -0.56, -0.3, 0.04],
        [0.5, -0.56, 0.4, 0.035],
        [-0.3, -0.56, -0.45, 0.045],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, i, 0]}>
          <boxGeometry args={[r * 4, r, r * 1.5]} />
          <meshStandardMaterial color={i % 2 ? '#b08d57' : '#3a2416'} metalness={i % 2 ? 0.7 : 0.1} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
