import React, { useRef, useState } from 'react';
import { Camera, X, ImagePlus, Loader2 } from 'lucide-react';
import { storage } from '@/api/supabaseApi';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompress';

/**
 * مكوّن رفع صورة عام — يرفع الصورة مباشرة من جهاز المستخدم إلى
 * Supabase Storage (بدل الاكتفاء برابط نصي يُلصق يدوياً)، مع معاينة
 * وزر حذف. يُستخدم لشعار المتجر، شعارات الماركات، وأي صورة إدارية أخرى.
 */
export default function ImageUploader({ value, onChange, bucket = 'branding', label = 'الصورة', shape = 'square', hint }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, 800, 0.8);
      const { file_url } = await storage.uploadFile({ file: compressed, bucket });
      onChange(file_url);
      toast.success('تم رفع الصورة بنجاح');
    } catch (err) {
      const msg = err?.message?.includes('Bucket not found')
        ? `مساحة تخزين (${bucket}) غير موجودة بعد في Supabase — شغّل ملف الهجرة supabase/migrations/004_storage_buckets_and_photo_cleanup.sql أولاً.`
        : 'فشل رفع الصورة، تأكد من اتصالك بالإنترنت وحاول مجدداً';
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
      <div className="flex items-center gap-3">
        <div
          className={`relative w-16 h-16 ${shape === 'round' ? 'rounded-full' : 'rounded-lg'} overflow-hidden border shrink-0 bg-muted flex items-center justify-center`}
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          {value ? (
            <img src={value} alt="معاينة" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-5 h-5 text-muted-foreground" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 h-9 rounded-md border text-sm font-bold flex items-center gap-2 hover:bg-muted transition-colors disabled:opacity-50"
            style={{ borderColor: 'hsl(var(--border))' }}
          >
            <Camera className="w-4 h-4" />
            {value ? 'تغيير الصورة' : 'رفع صورة من جهازك'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                storage.deleteFile(value, bucket).catch(() => {}); // best-effort
                onChange('');
              }}
              className="px-4 h-8 rounded-md text-xs text-destructive flex items-center gap-1.5 hover:bg-destructive/10 transition-colors w-fit"
            >
              <X className="w-3.5 h-3.5" />إزالة الصورة
            </button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      {hint && <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
}
