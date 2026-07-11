// ضغط الصورة قبل رفعها لـ Supabase Storage — تقلل الحجم والوقت
// دون التأثير على الوضوح بشكل ملحوظ.
export async function compressImage(file, maxWidth = 900, quality = 0.75) {
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
