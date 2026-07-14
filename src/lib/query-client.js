import { QueryClient, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

// ── Global safety net ───────────────────────────────────────────
// قبل هذا التعديل: أي عملية حفظ/تحديث/حذف تفشل (خطأ شبكة، صلاحيات،
// إلخ) كانت تفشل بصمت تام - لا رسالة خطأ، لا أي إشارة للمستخدم.
// هذا المعالج العام يعرض إشعاراً لأي طفرة (mutation) فاشلة، حتى لو
// نسي المطوّر إضافة onError الخاص بها. لا يستبدل onError المحلي؛
// كلاهما يعملان معاً.
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    // لا نكرر رسالة الخطأ إذا كانت الصفحة نفسها ستعرض onError خاص بها
    if (mutation?.options?.onError) return;
    toast.error(error?.message || 'حدث خطأ أثناء حفظ البيانات، حاول مرة أخرى');
  },
});

export const queryClientInstance = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      // ملاحظة: مع تفعيل RealtimeSync (يُبطل الكاش تلقائياً خلال نصف ثانية
      // من أي تغيير حقيقي بالقاعدة)، ما فيه داعي لـ staleTime قصير جداً —
      // كان مضبوط سابقاً 50ms وهذا خلّى كل تنقل بين الصفحات يعيد الجلب
      // من الصفر بدون داعي (بطء ملحوظ + طلبات مكررة كثيرة). 15 ثانية
      // تعطي توازن جيد: البيانات تتحدث تلقائياً فوراً عند أي تغيير حقيقي
      // (عبر Realtime)، وما تعيد الجلب من فراغ عند مجرد التنقل بين الصفحات.
      staleTime: 15_000,
    },
    mutations: {
      retry: 0,
    },
  },
});
