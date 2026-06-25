import React, { useState } from 'react';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const MAX_PHOTOS = 3;

export default function ItemPhotosUploader({ photos = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const remaining = MAX_PHOTOS - photos.length;
    const toUpload = files.slice(0, remaining);

    setUploading(true);
    const uploaded = [];
    for (const file of toUpload) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push(file_url);
    }
    onChange([...photos, ...uploaded]);
    setUploading(false);
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    const updated = photos.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <div>
      <label className="text-sm font-medium text-stone-700 flex items-center gap-2 mb-3">
        <Camera className="w-4 h-4 text-amber-500" />
        صور لنا أغراضك عشان نضبطك
        <span className="text-xs text-stone-400 font-normal">(حتى {MAX_PHOTOS} صور)</span>
      </label>

      <div className="grid grid-cols-3 gap-3">
        {photos.map((url, idx) => (
          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-stone-200 group">
            <img src={url} alt={`قطعة ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              className="absolute top-1.5 left-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <label className={`aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-400 hover:bg-amber-50 flex flex-col items-center justify-center cursor-pointer transition-all ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploading ? (
              <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-7 h-7 text-stone-400 mb-1" />
                <span className="text-xs text-stone-400">أضف صورة</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {photos.length > 0 && (
        <p className="text-xs text-stone-400 mt-2 text-right">
          ✓ تم رفع {photos.length} {photos.length === 1 ? 'صورة' : 'صور'} — ستظهر للفني قبل وصول قطعتك
        </p>
      )}
    </div>
  );
}