import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// كل الجداول اللي البرنامج يعرض بياناتها بصفحاته. أي تغيير عليها
// (INSERT / UPDATE / DELETE) من أي جهاز أو تبويب، يوصل هنا فوراً
// عبر Supabase Realtime، ونحن نبطل كل الكاش النشط على الشاشة
// فيعيد React Query جلبه من قاعدة البيانات مباشرة — بدون انتظار
// انتهاء staleTime وبدون الحاجة لإعادة تحميل الصفحة يدوياً.
const WATCHED_TABLES = [
  'orders', 'customers', 'employees', 'branches',
  'inventory_items', 'suppliers', 'supplier_products', 'products',
  'sales_invoices', 'expenses', 'audit_logs', 'app_settings',
  'loyalty_cards', 'loyalty_stamps', 'loyalty_settings',
  'loyalty_members', 'loyalty_points_transactions',
  'loyalty_member_notifications', 'loyalty_membership_settings',
  'bookings', 'services', 'reviews', 'working_hours',
  'brands', 'shop_settings', 'site_visits', 'stock_movements',
  'workshop_custodies', 'workshop_settlements', 'operations_plans',
  'workflow_stages',
];

export default function RealtimeSync() {
  const queryClient = useQueryClient();
  const pendingRef = useRef(false);

  useEffect(() => {
    // نجمّع كل الأحداث اللي توصل خلال نصف ثانية باستدعاء واحد فقط
    // (بدل ما نسوي عشرات invalidateQueries متتالية لو وصلت دفعة تغييرات
    // مرة وحدة، مثل تحديث المخزون لسطور فاتورة فيها منتجات كثيرة).
    const scheduleInvalidate = () => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setTimeout(() => {
        pendingRef.current = false;
        // بدون تحديد queryKey → يشمل كل مفاتيح الكاش، لكنه فعلياً
        // يعيد الجلب فقط للاستعلامات "النشطة" المعروضة حالياً بالشاشة
        // (سلوك invalidateQueries الافتراضي: refetchType: 'active').
        queryClient.invalidateQueries();
      }, 500);
    };

    const channel = supabase.channel('global_realtime_sync');
    WATCHED_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        scheduleInvalidate
      );
    });
    channel.subscribe();

    return () => supabase.removeChannel(channel);
  }, [queryClient]);

  return null;
}
