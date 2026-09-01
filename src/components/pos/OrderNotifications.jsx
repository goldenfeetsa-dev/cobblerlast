import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

const STATUS_LABELS = {
  pending: 'قيد الانتظار',
  in_progress: 'جارٍ التنفيذ',
  ready: 'جاهز للاستلام ✅',
  completed: 'مكتمل',
  cancelled: 'ملغى ❌',
};

const STATUS_COLORS = {
  ready: 'success',
  completed: 'success',
  cancelled: 'error',
};

export default function OrderNotifications() {
  const prevStatuses  = useRef({});
  const initialized   = useRef(false);

  // ── تنبيه "طلبات يجب تسليمها بعد يومين" — مرة وحدة كل يوم ──────
  // نستخدم localStorage عشان ما يتكرر التنبيه بكل مرة يفتح فيها
  // الموظف الصفحة بنفس اليوم — بس مرة وحدة يكفي لتنبيهه.
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = 'due-soon-notified-' + todayKey;
    if (localStorage.getItem(storageKey)) return;

    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    const targetDate = inTwoDays.toISOString().slice(0, 10);

    supabase.from('orders')
      .select('id, order_number, customer_name')
      .eq('delivery_date', targetDate)
      .not('status', 'in', '(completed,cancelled)')
      .then(({ data }) => {
        if (data && data.length > 0) {
          toast.warning(
            `⏰ ${data.length} طلب لازم يُسلَّم بعد يومين (${data.map(o => o.order_number).join('، ')})`,
            { duration: 10000 }
          );
        }
        localStorage.setItem(storageKey, '1');
      });
  }, []);

  useEffect(() => {
    // Load initial statuses
    supabase.from('orders').select('id, status, order_number, customer_name')
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        data?.forEach(o => { prevStatuses.current[o.id] = o.status; });
        initialized.current = true;
      });

    // Supabase Realtime
    const channel = supabase
      .channel('order_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (!initialized.current) return;
        const o = payload.new;
        toast.info(`طلب جديد: ${o.order_number} — ${o.customer_name}`, { duration: 5000 });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        if (!initialized.current) return;
        const o = payload.new;
        const prev = prevStatuses.current[o.id];
        if (prev && prev !== o.status) {
          const label = STATUS_LABELS[o.status] || o.status;
          const msg   = `الطلب ${o.order_number}: ${label}`;
          const type  = STATUS_COLORS[o.status];
          if (type === 'success') toast.success(msg, { duration: 5000 });
          else if (type === 'error') toast.error(msg, { duration: 5000 });
          else toast.info(msg, { duration: 5000 });
        }
        prevStatuses.current[o.id] = o.status;
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return null;
}
