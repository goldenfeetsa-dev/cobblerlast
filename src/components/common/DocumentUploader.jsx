import React, { useRef, useState } from 'react';
import { Camera, X, FileText, Loader2, FileCheck2 } from 'lucide-react';
import { storage } from '@/api/supabaseApi';
import { toast } from 'sonner';

/**
 * DocumentUploader — رفع مستند أرشيفي (صورة أو PDF) لفاتورة الشراء.
 * مطلب قانوني: الاحتفاظ بصورة/PDF لكل فاتورة مشتريات لعدة سنوات.
 * بدون ضغط (خصوصاً ملفات PDF)، ورفعها مباشرة لمساحة purchase-invoices.
 */
export default function DocumentUploader({ value, onChange, bucket = 'purchase-invoices', label = 'مستند الفاتورة (صورة أو PDF)' }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const okType = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!okType) {
      toast.error('الملف لازم يكون صورة أو PDF فقط');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await storage.uploadFile({ file, bucket });
      onChange(file_url);
      toast.success('تم رفع مستند الفاتورة');
    } catch (err) {
      const msg = err?.message?.includes('Bucket not found')
        ? `مساحة تخزين (${bucket}) غير موجودة بعد — شغّل ملف الهجرة supabase/migrations/016_purchasing_tax_module.sql أولاً.`
        : 'فشل رفع الملف، تأكد من اتصالك بالإنترنت وحاول مجدداً';
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const isPdf = value && value.toLowerCase().includes('.pdf');

  return (
    <div>
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border shrink-0 bg-muted flex items-center justify-center" style={{ borderColor: 'hsl(var(--border))' }}>
          {value ? (
            isPdf ? <FileCheck2 className="w-6 h-6 text-primary" /> : <img src={value} alt="مستند الفاتورة" className="w-full h-full object-cover" />
          ) : (
            <FileText className="w-5 h-5 text-muted-foreground" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-4 h-9 rounded-md border text-sm font-bold flex items-center gap-2 hover:bg-muted transition-colors disabled:opacity-50"
            style={{ borderColor: 'hsl(var(--border))' }}>
            <Camera className="w-4 h-4" />
            {value ? 'تغيير الملف' : 'رفع صورة/PDF الفاتورة'}
          </button>
          {value && (
            <button type="button" onClick={() => { storage.deleteFile(value, bucket).catch(() => {}); onChange(''); }}
              className="px-4 h-8 rounded-md text-xs text-destructive flex items-center gap-1.5 hover:bg-destructive/10 transition-colors w-fit">
              <X className="w-3.5 h-3.5" />إزالة الملف
            </button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} />
      <p className="text-[11px] text-muted-foreground mt-2">يُحفظ كأرشيف قانوني للفاتورة — لا يُحذف تلقائياً.</p>
    </div>
  );
}
