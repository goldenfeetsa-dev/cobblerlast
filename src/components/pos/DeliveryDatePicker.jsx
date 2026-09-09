import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfDay, getDay } from 'date-fns';

const DAY_NAMES = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// حد الطلبات اليومي — فوقه يوم "مزدحم بالكامل" ويُمنع الاختيار
const DAILY_CAPACITY = 8;

export default function DeliveryDatePicker({ value, onChange }) {
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);

  // نجيب بس delivery_date لكل الطلبات (غير الملغاة) بحدود الشهر المعروض
  // — عمود واحد خفيف، ونعد بالجافاسكربت بدل جولة شبكة لكل يوم
  const { data: counts = {} } = useQuery({
    queryKey: ['delivery-date-counts', format(monthStart, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('delivery_date')
        .gte('delivery_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('delivery_date', format(monthEnd, 'yyyy-MM-dd'))
        .neq('status', 'cancelled');
      if (error) throw error;
      const map = {};
      (data || []).forEach(o => {
        if (!o.delivery_date) return;
        const key = String(o.delivery_date).slice(0, 10);
        map[key] = (map[key] || 0) + 1;
      });
      return map;
    },
    staleTime: 30000,
  });

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);
  const paddedDays = [...Array(startPad).fill(null), ...days];

  const dayLoad = (date) => counts[format(date, 'yyyy-MM-dd')] || 0;

  // أخضر: فاضي/متاح (أقل من نص الحد) — أصفر: شبه مزدحم — أحمر: مزدحم بالكامل (ممنوع)
  const loadColor = (n) => {
    if (n >= DAILY_CAPACITY) return { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c', dot: '#ef4444', label: 'ممتلئ' };
    if (n >= Math.ceil(DAILY_CAPACITY / 2)) return { bg: '#fef9c3', border: '#fde047', text: '#a16207', dot: '#eab308', label: 'شبه ممتلئ' };
    return { bg: '#dcfce7', border: '#86efac', text: '#15803d', dot: '#22c55e', label: 'متاح' };
  };

  const selectedDate = value ? new Date(value) : null;

  return (
    <div className="border rounded-xl p-3 bg-white dark:bg-stone-900" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">
          <ChevronRight className="w-4 h-4" />
        </button>
        <p className="font-bold text-sm">{format(viewDate, 'MMMM yyyy')}</p>
        <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map(d => <div key={d} className="text-[10px] text-center text-muted-foreground font-bold py-1">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;
          const past = isBefore(date, today);
          const n = dayLoad(date);
          const full = n >= DAILY_CAPACITY;
          const disabled = past || full;
          const color = loadColor(n);
          const selected = selectedDate && isSameDay(date, selectedDate);

          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onChange(format(date, 'yyyy-MM-dd'))}
              title={past ? 'تاريخ فائت' : `${n} طلب مسجّل — ${color.label}`}
              className={cn(
                "relative aspect-square rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all",
                selected && "ring-2 ring-offset-1",
                past && "opacity-30 cursor-not-allowed bg-stone-50",
                disabled && !past && "cursor-not-allowed",
              )}
              style={!past ? {
                background: color.bg,
                border: `1px solid ${color.border}`,
                color: color.text,
                ...(selected ? { boxShadow: `0 0 0 2px ${color.dot}` } : {}),
              } : undefined}
            >
              <span>{format(date, 'd')}</span>
              {!past && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color.dot }} />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> متاح</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> شبه ممتلئ</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> ممتلئ (لا يمكن الاختيار)</span>
      </div>
    </div>
  );
}
