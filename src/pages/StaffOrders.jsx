/**
 * StaffOrders — عرض الطلبات للعمال فقط
 * بدون أسعار، بدون بيانات العميل، فقط ما يحتاجه العامل للعمل
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { getSession } from '@/lib/sessionStore';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Scissors, Package, CheckCircle, Clock, Search, Filter, CalendarDays } from 'lucide-react';

const ITEM_LABELS = {
  shoes: 'أحذية 👟', bag: 'حقيبة 👜', dress: 'فستان 👗',
  suit: 'بدلة 👔', jacket: 'جاكيت 🧥', pants: 'بنطال 👖',
  shirt: 'قميص 👕', other: 'أخرى 📦'
};

const STATUS = {
  pending:     { label: 'قيد الانتظار', color: '#f59e0b', bg: '#fef3c7', next: 'in_progress', nextLabel: 'ابدأ العمل ▶' },
  in_progress: { label: 'جارٍ التنفيذ', color: '#3b82f6', bg: '#dbeafe', next: 'ready',       nextLabel: 'تم الإنجاز ✅' },
  ready:       { label: 'جاهز للاستلام', color: '#10b981', bg: '#d1fae5', next: null,         nextLabel: null },
  completed:   { label: 'مكتمل',         color: '#6b7280', bg: '#f3f4f6', next: null,         nextLabel: null },
  cancelled:   { label: 'ملغى',          color: '#ef4444', bg: '#fee2e2', next: null,         nextLabel: null },
};

export default function StaffOrders() {
  const session     = getSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active'); // active | all

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['staff-orders', session?.branch_id, filter],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('id, order_number, item_type, description, notes, status, created_at, shelf_location, photos')
        .order('created_at', { ascending: true });

      if (session?.branch_id) q = q.eq('branch_id', session.branch_id);
      if (filter === 'active') q = q.in('status', ['pending', 'in_progress']);

      const { data } = await q.limit(100);
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => supabase.from('orders').update({ status }).eq('id', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      toast.success('✅ تم تحديث حالة الطلب');
    },
    onError: () => toast.error('فشل التحديث'),
  });

  const filtered = orders.filter(o =>
    !search ||
    o.order_number?.includes(search) ||
    o.description?.includes(search) ||
    o.shelf_location?.includes(search)
  );

  // إحصائيات سريعة
  const myPending    = orders.filter(o => o.status === 'pending').length;
  const myInProgress = orders.filter(o => o.status === 'in_progress').length;

  return (
    <div className="space-y-5 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Scissors className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-black">مهامك اليوم</h1>
            <p className="text-sm text-gray-500">مرحباً {session?.name || 'موظف'}</p>
          </div>
        </div>
        <Link to="/calendar" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
          <CalendarDays className="w-3.5 h-3.5" />
          الجدول المرئي
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 bg-amber-50 border border-amber-100 flex items-center gap-3">
          <Clock className="w-6 h-6 text-amber-500" />
          <div>
            <div className="text-2xl font-black text-amber-600">{myPending}</div>
            <div className="text-xs text-amber-500">بانتظار البدء</div>
          </div>
        </div>
        <div className="rounded-xl p-4 bg-blue-50 border border-blue-100 flex items-center gap-3">
          <Package className="w-6 h-6 text-blue-500" />
          <div>
            <div className="text-2xl font-black text-blue-600">{myInProgress}</div>
            <div className="text-xs text-blue-500">جارٍ التنفيذ</div>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث برقم الطلب أو الوصف..." className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-300" />
        </div>
        <button onClick={() => setFilter(f => f === 'active' ? 'all' : 'active')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${filter === 'active' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
          <Filter className="w-3.5 h-3.5" />
          {filter === 'active' ? 'النشطة' : 'الكل'}
        </button>
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
          <p className="font-bold">لا توجد طلبات نشطة</p>
          <p className="text-sm mt-1">أحسنت! كل المهام منجزة 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((order, i) => {
              const st = STATUS[order.status] || STATUS.pending;
              const ageHours = (Date.now() - new Date(order.created_at)) / 3_600_000;
              const isUrgent = ageHours > 24 && order.status !== 'completed' && order.status !== 'cancelled';

              return (
                <motion.div key={order.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className={`rounded-2xl border overflow-hidden ${isUrgent ? 'border-red-200' : 'border-gray-100'}`}
                  style={{ background: isUrgent ? '#fff8f8' : 'white' }}>

                  {/* Top bar */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ background: st.bg, borderBottom: `1px solid ${st.color}22` }}>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm" style={{ color: st.color }}>{order.order_number}</span>
                      {isUrgent && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">عاجل ⚡</span>}
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: 'white', color: st.color, border: `1px solid ${st.color}40` }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3 space-y-2">
                    {/* Item type */}
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ITEM_LABELS[order.item_type]?.split(' ')[1] || '📦'}</span>
                      <span className="font-bold text-gray-900">{ITEM_LABELS[order.item_type]?.split(' ')[0] || 'قطعة'}</span>
                    </div>

                    {/* Description */}
                    {(order.description || order.notes) && (
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                        {order.description || order.notes}
                      </div>
                    )}

                    {/* Shelf */}
                    {order.shelf_location && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500">الرف:</span>
                        <span className="font-bold text-gray-800">{order.shelf_location}</span>
                      </div>
                    )}

                    {/* Photos */}
                    {order.photos?.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {order.photos.map((url, pi) => (
                          <img key={pi} src={url} alt="صورة القطعة" loading="lazy"
                            className="w-16 h-16 rounded-lg object-cover border border-gray-100 shrink-0" />
                        ))}
                      </div>
                    )}

                    {/* Action button */}
                    {st.next && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: order.id, status: st.next })}
                        className="w-full py-2.5 rounded-xl font-black text-sm text-white mt-1 transition-all disabled:opacity-60"
                        style={{ background: st.next === 'ready' ? '#10b981' : '#3b82f6' }}>
                        {updateMutation.isPending ? '...' : st.nextLabel}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
