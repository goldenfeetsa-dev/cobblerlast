import React, { useRef, useState } from 'react';
import { Camera, X, ImagePlus, Loader2 } from 'lucide-react';
import { storage } from '@/api/supabaseApi';
import { toast } from 'sonner';

// ── ضغط الصورة قبل الرفع ──────────────────────────────────────
// نفس منطق ضغط صور الطلبات: عرض أقصى 1000px (أوضح شوي لأنها صور منتج
// للعرض العام) وجودة JPEG 0.75 — توازن جيد بين الوضوح وسرعة التحميل.
async function compressImage(file, maxWidth = 1000, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          const result = blob && blob.size < file.size ? blob : file;
          const compressed = new File([result], file.name, { type: 'image/jpeg' });
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * رفع صورة منتج حقيقية من جهاز التاجر مباشرة إلى تخزين Supabase
 * (bucket: shop-products) بدل الاكتفاء برابط نصي يُلصق يدوياً.
 * هذا يضمن أن الصورة المعروضة في المتجر هي صورة فعلية للمنتج،
 * وهو شرط أساسي حتى تظهر المنتجات في "بحث الصور" و"Google Shopping".
 */
export default function ProductImageUploader({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const compressed = await compressImage(file);
      const { file_url } = await storage.uploadFile({ file: compressed, bucket: 'shop-products' });
      onChange(file_url);
      toast.success('تم رفع صورة المنتج بنجاح');
    } catch (err) {
      const msg = err?.message?.includes('Bucket not found')
        ? 'مساحة تخزين صور المتجر (shop-products) غير موجودة بعد في Supabase — أنشئها من Storage ثم أعد المحاولة.'
        : 'فشل رفع الصورة، تأكد من اتصالك بالإنترنت وحاول مجدداً';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground mb-1 block">صورة المنتج *</label>

      <div className="flex items-center gap-3">
        <div className="relative w-20 h-20 rounded-lg overflow-hidden border shrink-0 bg-muted flex items-center justify-center"
          style={{ borderColor: 'hsl(var(--border))' }}>
          {value ? (
            <img src={value} alt="معاينة صورة المنتج" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-6 h-6 text-muted-foreground" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 h-9 rounded-md border text-sm font-bold flex items-center gap-2 hover:bg-muted transition-colors disabled:opacity-50"
            style={{ borderColor: 'hsl(var(--border))' }}>
            <Camera className="w-4 h-4" />
            {value ? 'تغيير الصورة' : 'رفع صورة من جهازك'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-4 h-8 rounded-md text-xs text-destructive flex items-center gap-1.5 hover:bg-destructive/10 transition-colors w-fit">
              <X className="w-3.5 h-3.5" />إزالة الصورة
            </button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <p className="text-[11px] text-muted-foreground mt-2">
        استخدم صورة حقيقية وواضحة للمنتج (مربّعة إن أمكن) — هذا يرفع فرصة ظهور منتجاتك في نتائج بحث الصور بجوجل.
      </p>
    </div>
  );
}
