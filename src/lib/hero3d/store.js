import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────
// Store مركزي لمشهد الهيرو ثلاثي الأبعاد.
// يمسك حالة التفاعل (input) بعيداً عن مكونات R3F نفسها حتى ما
// نعمل re-render لشجرة Three.js كل ما يتغيّر شي بسيط بالواجهة.
// ─────────────────────────────────────────────────────────────────
export const useHeroStore = create((set) => ({
  // أي عنصر HTML متفاعل عليه الماوس حالياً (يُستخدم لتحريك الكاميرا
  // بشكل خفيف نحو نفس الاتجاه — "parallax" بسيط)
  pointer: { x: 0, y: 0 },
  setPointer: (x, y) => set({ pointer: { x, y } }),

  // هل الذراع تشتغل حالياً؟ (يمكن إيقافها لتوفير الأداء لو الهيرو
  // خرج من إطار الشاشة، عبر IntersectionObserver في الصفحة الأب)
  isActive: true,
  setActive: (isActive) => set({ isActive }),

  // اللوحة المفتوحة فوق الـ Canvas: null | 'tracking' | 'booking'
  openPanel: null,
  togglePanel: (panel) =>
    set((s) => ({ openPanel: s.openPanel === panel ? null : panel })),
  closePanel: () => set({ openPanel: null }),
}));
