import { supabase } from '@/lib/supabaseClient';

// إرسال SMS مباشر لجوال العميل (بدون الحاجة لبطاقة ولاء مسبقة).
// غير حاجب (non-blocking) بطبيعته — استخدمها بدون await إذا ما تبي
// تأخير حفظ الطلب بانتظار الرد من مزوّد الرسائل.
// ترجع true/false، ولا ترمي استثناء أبداً حتى ما توقف عملية الطلب.
export async function notifyCustomerDirect(phone, message) {
  if (!phone || !message) return false;
  try {
    const { data, error } = await supabase.functions.invoke('loyalty-notify', {
      body: { mode: 'direct', phone, message },
    });
    if (error) { console.warn('notifyCustomerDirect error:', error.message); return false; }
    return !!data?.sent;
  } catch (e) {
    console.warn('notifyCustomerDirect failed:', e?.message);
    return false;
  }
}
