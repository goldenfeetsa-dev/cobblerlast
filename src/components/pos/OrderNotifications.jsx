import React, { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const STATUS_LABELS = {
  pending: 'قيد الانتظار',
  in_progress: 'جارٍ التنفيذ',
  ready: 'جاهز للاستلام ✅',
  completed: 'مكتمل',
  cancelled: 'ملغى ❌',
  returned: 'مُسترجع',
  exchanged: 'مُستبدَل',
  on_hold: 'متوقف ⏸',
};

const STATUS_COLORS = {
  ready: 'success',
  cancelled: 'error',
  returned: 'warning',
  on_hold: 'warning',
  completed: 'success',
};

export default function OrderNotifications() {
  const prevStatuses = useRef({});
  const initialized = useRef(false);

  useEffect(() => {
    const unsubscribe = base44.entities.Order.subscribe((event) => {
      if (!initialized.current) return;

      if (event.type === 'create') {
        toast.info(`طلب جديد: ${event.data?.order_number} - ${event.data?.customer_name}`, { duration: 5000 });
        return;
      }

      if (event.type === 'update') {
        const order = event.data;
        const prevStatus = prevStatuses.current[event.id];
        if (prevStatus && prevStatus !== order.order_status) {
          const label = STATUS_LABELS[order.order_status] || order.order_status;
          const msg = `الطلب ${order.order_number}: ${label}`;
          const type = STATUS_COLORS[order.order_status];
          if (type === 'success') toast.success(msg, { duration: 5000 });
          else if (type === 'error') toast.error(msg, { duration: 5000 });
          else toast.warning(msg, { duration: 5000 });
        }
        prevStatuses.current[event.id] = order.order_status;
      }
    });

    // Load initial statuses silently
    base44.entities.Order.list('-created_date', 200).then(orders => {
      orders.forEach(o => { prevStatuses.current[o.id] = o.order_status; });
      initialized.current = true;
    });

    return unsubscribe;
  }, []);

  return null;
}