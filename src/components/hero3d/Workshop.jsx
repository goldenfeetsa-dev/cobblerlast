import React, { useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────
// غرفة الورشة — خشب داكن + مكتب جلدي + فتحة نافذة على اليسار
// تكشف عن أفق مدينة مبسّط (مباني + نوافذ مضيئة إجرائية، مو صورة
// حقيقية) بإضاءة دافئة شبيهة بالغروب.
// ─────────────────────────────────────────────────────────────────
function Skyline() {
  // نولّد مباني عشوائية مرة وحدة فقط (useMemo) — كل مبنى صندوق
  // بارتفاع عشوائي + نوافذ صغيرة مضيئة (emissive) موزّعة عليه
  const buildings = useMemo(() => {
    const arr = [];
    let x = -3.2;
    while (x < 3.2) {
      const w = 0.25 + Math.random() * 0.35;
      const h = 0.8 + Math.random() * 2.6;
      arr.push({ x, w, h, windows: Math.floor(h * 4) });
      x += w + 0.06;
    }
    return arr;
  }, []);

  return (
    <group position={[0, -0.2, -0.05]}>
      {/* سماء الغسق خلف المباني */}
      <mesh position={[0, 1, -0.3]}>
        <planeGeometry args={[8, 5]} />
        <meshBasicMaterial color="#2a1f3d" />
      </mesh>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, 0]}>
          <mesh>
            <boxGeometry args={[b.w, b.h, 0.2]} />
            <meshStandardMaterial color="#151020" roughness={0.9} />
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
              <planeGeometry args={[0.035, 0.05]} />
              <meshBasicMaterial color="#f4c97a" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function Workshop() {
  const woodDark = { color: '#1c130d', roughness: 0.75, metalness: 0.05 };
  const woodPanel = { color: '#2a1c12', roughness: 0.6, metalness: 0.05 };
  const desk = { color: '#241812', roughness: 0.4, metalness: 0.1 };

  return (
    <group>
      {/* الأرضية */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial {...woodDark} />
      </mesh>

      {/* الجدار الخلفي (لوح خشبي داكن) */}
      <mesh position={[0, 1, -1.6]}>
        <planeGeometry args={[7, 4.5]} />
        <meshStandardMaterial {...woodPanel} />
      </mesh>

      {/* إطار النافذة الكبيرة على اليسار */}
      <group position={[-2.3, 0.9, -1.55]}>
        <Skyline />
        {/* إطار خشبي حول فتحة النافذة */}
        <mesh position={[0, 2.1, 0.02]}>
          <boxGeometry args={[3.4, 0.12, 0.08]} />
          <meshStandardMaterial {...woodPanel} />
        </mesh>
        <mesh position={[0, -2.1, 0.02]}>
          <boxGeometry args={[3.4, 0.12, 0.08]} />
          <meshStandardMaterial {...woodPanel} />
        </mesh>
        <mesh position={[-1.65, 0, 0.02]}>
          <boxGeometry args={[0.12, 4.2, 0.08]} />
          <meshStandardMaterial {...woodPanel} />
        </mesh>
        <mesh position={[1.65, 0, 0.02]}>
          <boxGeometry args={[0.12, 4.2, 0.08]} />
          <meshStandardMaterial {...woodPanel} />
        </mesh>
      </group>

      {/* المكتب الجلدي الداكن أسفل الحذاء العائم */}
      <mesh position={[0, -0.62, 0]}>
        <boxGeometry args={[4.2, 0.08, 1.6]} />
        <meshStandardMaterial {...desk} />
      </mesh>

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
