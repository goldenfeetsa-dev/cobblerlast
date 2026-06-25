import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, ImagePlus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── ضغط الصورة قبل الرفع ──────────────────────────────────────
// يضغط إلى أقصى حد: 800px عرض أقصى، جودة 0.65 JPEG
async function compressImage(file, maxWidth = 800, quality = 0.65) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          // إذا كان الضغط زاد الحجم (نادراً) نرجع الأصل
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

export default function PhotoUploader({ photos, setPhotos, maxPhotos = 5 }) {
  const fileRef   = useRef(null);
  const cameraRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = maxPhotos - photos.length;
    const toUpload  = files.slice(0, remaining);

    setUploading(true);
    try {
      for (const rawFile of toUpload) {
        // ضغط الصورة أولاً
        const compressed = await compressImage(rawFile);
        const sizeBefore = (rawFile.size / 1024).toFixed(0);
        const sizeAfter  = (compressed.size / 1024).toFixed(0);
        console.info(`📸 ضغط: ${sizeBefore}KB → ${sizeAfter}KB`);

        const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
        setPhotos(prev => [...prev, file_url]);
      }
    } catch (err) {
      toast.error('فشل رفع الصورة، حاول مجدداً');
      console.error('Photo upload error:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (idx) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          الصور ({photos.length}/{maxPhotos})
        </span>
        {uploading && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />جارٍ الرفع...
          </span>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        <AnimatePresence>
          {photos.map((url, i) => (
            <motion.div
              key={url}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative aspect-square rounded-lg overflow-hidden border border-border group"
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {photos.length < maxPhotos && !uploading && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <ImagePlus className="w-5 h-5" />
              <span className="text-[10px] mt-1">رفع</span>
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <Camera className="w-5 h-5" />
              <span className="text-[10px] mt-1">كاميرا</span>
            </button>
          </div>
        )}

        {uploading && (
          <div className="aspect-square rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      <input ref={fileRef}   type="file" accept="image/*" multiple  className="hidden" onChange={handleUpload} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />

      <p className="text-[11px] text-muted-foreground">
        الصور تُحذف تلقائياً بعد أسبوعين من إكمال الطلب
      </p>
    </div>
  );
}
