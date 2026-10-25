import React, { useEffect, useState } from 'react';

// يحوّل أي شعار (حتى لو كان بخلفية بيضاء أو ملونة) إلى شعار عاجي بخلفية
// شفافة حقيقية، ليذوب في الخلفية الداكنة بدون أي مربعات. المعالجة تتم
// بالمتصفح مرة واحدة لكل شعار وتُخزَّن بالذاكرة. لو تعذّرت المعالجة (CORS)
// نرجع لفلتر CSS كحل بديل.
const cache = new Map();

function process(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const max = 480;
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k));
        const h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h);
        const px = d.data;
        const lum = (i) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
        const cornerAlpha = corners.reduce((a, i) => a + px[i + 3], 0) / 4;
        const transparentBg = cornerAlpha < 40;
        const bgLum = corners.reduce((a, i) => a + lum(i), 0) / 4;
        for (let i = 0; i < px.length; i += 4) {
          let a;
          if (transparentBg) a = px[i + 3];
          else a = Math.min(255, (Math.abs(lum(i) - bgLum) / 110) * 255) * (px[i + 3] / 255);
          px[i] = 236; px[i + 1] = 232; px[i + 2] = 223; px[i + 3] = a;
        }
        ctx.putImageData(d, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
  cache.set(url, p);
  return p;
}

export default function CleanLogo({ src, alt = '', className = '', style = {} }) {
  const [out, setOut] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setOut(null); setFailed(false);
    if (!src) return;
    process(src).then((u) => live && setOut(u)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [src]);
  if (failed) {
    return <img src={src} alt={alt} loading="lazy" className={className}
      style={{ ...style, filter: 'grayscale(1) invert(1)', mixBlendMode: 'screen' }} />;
  }
  return <img src={out || undefined} alt={alt} className={className}
    style={{ ...style, opacity: out ? 1 : 0, transition: 'opacity .3s' }} />;
}
