import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // لا تعيد المحاولة على أخطاء 4xx (بيانات خاطئة، غير مصرح، إلخ)
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000, // 30 ثانية قبل إعادة الجلب
    },
    mutations: {
      onError: (error) => {
        // Global mutation error handler — يُستدعى فقط إذا لم يُعرَّف onError محلي
        const msg = error?.message || 'حدث خطأ، حاول مجدداً';
        if (!msg.includes('toast')) { // تجنب التكرار
          toast.error(msg);
        }
      },
    },
  },
});
