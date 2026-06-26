// app-params.js — بدون أي مرجع لـ Base44
// يُستخدم فقط لقراءة معاملات الـ URL إذا احتاجها أي مكون
export const appParams = {
  appId: import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'cobblerlast',
};
