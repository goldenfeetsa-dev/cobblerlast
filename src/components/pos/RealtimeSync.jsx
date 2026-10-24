import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// المزامنة اللحظية عبر Supabase Realtime أُوقفت لأن قاعدة البيانات صارت مقفولة عن
// المتصفح (كل شيء عبر بوابة الخادم). بدلها: تحديث دوري خفيف للاستعلامات المعروضة
// فقط، وعند عودة المستخدم للتبويب.
const EVERY_MS = 20000;

export default function RealtimeSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') queryClient.invalidateQueries(); };
    const id = setInterval(tick, EVERY_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [queryClient]);
  return null;
}
