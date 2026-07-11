import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, AlertTriangle, CheckCircle, Clock, Package, X, Bell } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

const CAPACITY = 8; // أقصى طاقة استيعابية يومياً

const STATUS_CONFIG = {
  pending:     { label: 'انتظار',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  in_progress: { label: 'جارٍ التنفيذ', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  ready:       { label: 'جاهز',         color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  completed:   { label: 'مكتمل',        color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  cancelled:   { label: 'ملغى',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
};

// ── شريط حالة الطلبات الشامل ─────────────────────────────────────
export function OrderStatusBar() {
  const { data: orders = [] } = useQuery({
    queryKey: ['orders-status-bar'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, status, created_at, item_type')
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true })
        .limit(100);
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const now = new Date();
  const stats = useMemo(() => {
    const completed  = orders.filter(o => o.status === 'completed').length;
    const inProgress = orders.filter(o => o.status === 'in_progress').length;
    const pending    = orders.filter(o => o.status === 'pending').length;
    const late       = orders.filter(o => {
      const age = (now - new Date(o.created_at)) / (1000 * 60 * 60 * 24);
      return age > 3 && o.status !== 'completed' && o.status !== 'cancelled';
    }).length;
    return { completed, inProgress, pending, late, total: orders.length };
  }, [orders]);

  return (
    <div className="space-y-3" dir="rtl">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'قيد الانتظار', value: stats.pending,    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: Clock },
          { label: 'جارٍ التنفيذ', value: stats.inProgress, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: Package },
          { label: 'مكتمل اليوم',  value: stats.completed,  color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  icon: CheckCircle },
          { label: 'متأخر',        value: stats.late,       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  icon: AlertTriangle },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="rounded-xl p-3 flex items-center gap-3" style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
            <s.icon className="w-5 h-5 shrink-0" style={{ color: s.color }} />
            <div>
              <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
          <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
            <span>شريط حالة الطلبات النشطة ({orders.length} طلب)</span>
            {stats.late > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-bold">
                <AlertTriangle className="w-3 h-3" />{stats.late} متأخر
              </span>
            )}
          </div>
          <div className="flex gap-0.5 h-5 rounded-lg overflow-hidden">
            {orders.map((order, i) => {
              const isLate = (now - new Date(order.created_at)) / (1000*60*60*24) > 3;
              const cfg = isLate ? { color: '#ef4444' } : STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              return (
                <motion.div key={order.id} title={`${order.order_number} — ${order.customer_name} — ${STATUS_CONFIG[order.status]?.label}`}
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.02 }}
                  className="flex-1 cursor-pointer hover:opacity-80 transition-opacity" style={{ background: cfg.color, minWidth: 4 }} />
              );
            })}
          </div>
          <div className="flex gap-4 mt-2.5 flex-wrap">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.color }} />
                <span className="text-gray-500">{cfg.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span className="text-gray-500">متأخر &gt;3 أيام</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── التقويم المرئي ────────────────────────────────────────────────
export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay]   = useState(null);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-calendar', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end   = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, status, created_at, delivery_date, item_type, total_price')
        .gte('delivery_date', start)
        .lte('delivery_date', end)
        .order('delivery_date');
      return data || [];
    },
    staleTime: 60_000,
  });

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

  // توزيع الطلبات على الأيام حسب تاريخ التسليم (وليس تاريخ الإنشاء)
  const ordersByDay = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (!o.delivery_date) return; // طلبات قديمة بدون تاريخ تسليم لا تُحسب هنا
      const key = o.delivery_date; // عمود delivery_date من نوع date أصلاً بصيغة yyyy-MM-dd
      if (!map[key]) map[key] = [];
      map[key].push(o);
    });
    return map;
  }, [orders]);

  // الأيام التي فيها ضغط عالٍ
  const highPressureDays = useMemo(() =>
    Object.entries(ordersByDay)
      .filter(([, list]) => list.length >= CAPACITY * 0.75)
      .map(([date]) => date),
    [ordersByDay]
  );

  const selectedOrders = selectedDay ? (ordersByDay[format(selectedDay, 'yyyy-MM-dd')] || []) : [];

  const firstDayOffset = (days[0].getDay() + 1) % 7; // للعرب يبدأ من السبت

  const getDayStyle = (day) => {
    const key = format(day, 'yyyy-MM-dd');
    const dayOrders = ordersByDay[key] || [];
    const count = dayOrders.length;
    const pressure = count / CAPACITY;
    const isSelected = selectedDay && isSameDay(day, selectedDay);

    if (isSelected) return { bg: '#1A0F00', border: '#C9A84C', text: '#F5EDD8' };
    if (pressure >= 1) return { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#ef4444' };
    if (pressure >= 0.75) return { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#f59e0b' };
    if (count > 0) return { bg: 'rgba(34,197,94,0.08)', border: '#22c55e', text: '#22c55e' };
    return { bg: isToday(day) ? 'rgba(201,168,76,0.08)' : 'transparent', border: isToday(day) ? '#C9A84C' : '#e5e7eb', text: '#374151' };
  };

  // تنبيهات الضغط
  const alerts = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return Object.entries(ordersByDay)
      .filter(([date, list]) => date >= today && list.length >= CAPACITY * 0.75)
      .slice(0, 3);
  }, [ordersByDay]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* تنبيهات الضغط */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(([date, list]) => (
            <motion.div key={date} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: list.length >= CAPACITY ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${list.length >= CAPACITY ? '#ef444430' : '#f59e0b30'}` }}>
              <Bell className="w-4 h-4 shrink-0" style={{ color: list.length >= CAPACITY ? '#ef4444' : '#f59e0b' }} />
              <span className="font-bold" style={{ color: list.length >= CAPACITY ? '#ef4444' : '#f59e0b' }}>
                {list.length >= CAPACITY ? '🔴 طاقة ممتلئة' : '🟡 ضغط عالٍ'} —
              </span>
              <span className="text-gray-600">
                {format(parseISO(date), 'EEEE d MMMM', { locale: ar })} — {list.length}/{CAPACITY} طلب
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* التقويم */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <div className="text-center">
            <h2 className="font-black text-gray-900">{format(currentMonth, 'MMMM yyyy', { locale: ar })}</h2>
            <p className="text-xs text-gray-400">{orders.length} طلب هذا الشهر</p>
          </div>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* أيام الأسبوع */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-bold text-gray-400">{d}</div>
          ))}
        </div>

        {/* الأيام */}
        <div className="grid grid-cols-7">
          {/* offset */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-16 border-b border-l border-gray-50" />
          ))}

          {days.map((day, idx) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayOrders = ordersByDay[key] || [];
            const style = getDayStyle(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);

            return (
              <motion.button key={key} whileHover={{ scale: 0.97 }} whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className="h-16 p-1.5 border-b border-l border-gray-50 flex flex-col items-center justify-between transition-all"
                style={{ background: style.bg, borderColor: isSelected ? style.border : undefined,
                  outline: isSelected ? `2px solid ${style.border}` : 'none', outlineOffset: -2 }}>
                <span className={`text-xs font-bold ${isToday(day) ? 'text-amber-600' : ''}`} style={{ color: style.text }}>
                  {format(day, 'd')}
                </span>
                {dayOrders.length > 0 && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-black" style={{ color: style.border || style.text }}>
                      {dayOrders.length}
                    </span>
                    <div className="flex gap-0.5">
                      {dayOrders.slice(0, 4).map((o, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: STATUS_CONFIG[o.status]?.color || '#9ca3af' }} />
                      ))}
                      {dayOrders.length > 4 && <span className="text-[8px] text-gray-400">+{dayOrders.length - 4}</span>}
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 px-1">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e' }} />طلبات عادية</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b' }} />ضغط عالٍ (75%+)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444' }} />طاقة ممتلئة ({CAPACITY}+ طلب)</div>
      </div>

      {/* تفاصيل اليوم المحدد */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-black text-gray-900">
                {format(selectedDay, 'EEEE d MMMM yyyy', { locale: ar })}
                <span className="text-sm font-normal text-gray-400 mr-2">({selectedOrders.length} طلب)</span>
              </h3>
              <button onClick={() => setSelectedDay(null)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-50">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            {selectedOrders.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">لا توجد طلبات في هذا اليوم</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {selectedOrders.map((order, i) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const isLate = order.delivery_date < format(new Date(), 'yyyy-MM-dd')
                    && order.status !== 'completed' && order.status !== 'cancelled';
                  return (
                    <motion.div key={order.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 px-5 py-3">
                      <div className="w-2 h-8 rounded-full shrink-0" style={{ background: isLate ? '#ef4444' : cfg.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">{order.order_number}</span>
                          {isLate && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">متأخر</span>}
                        </div>
                        <div className="text-xs text-gray-500">{order.customer_name}</div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold shrink-0"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                      {order.total_price > 0 && (
                        <span className="text-xs font-bold text-gray-600 shrink-0">{order.total_price} ر.س</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
