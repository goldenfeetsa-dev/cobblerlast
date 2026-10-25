import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfDay, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';

const DAY_NAMES = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function CalendarPicker({ selectedDate, selectedTime, onDateChange, onTimeChange, serviceDuration = 30 }) {
  const [viewDate, setViewDate] = useState(new Date());

  const { data: workingHours = [] } = useQuery({
    queryKey: ['working-hours'],
    queryFn: () => db.WorkingHours.list(),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-calendar'],
    queryFn: () => db.Booking.filter({ status: ['pending', 'confirmed', 'in_progress'] }),
    refetchInterval: 30000,
  });

  const today = startOfDay(new Date());
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start
  const startPad = getDay(monthStart);
  const paddedDays = [...Array(startPad).fill(null), ...days];

  const getWorkingHoursForDay = (date) => {
    const dow = getDay(date);
    return workingHours.find(wh => wh.day_of_week === dow);
  };

  const isDayAvailable = (date) => {
    if (isBefore(date, today)) return false;
    const wh = getWorkingHoursForDay(date);
    // لو ما فيه صف محفوظ لهذا اليوم أصلاً في أوقات العمل، اليوم يُعتبر
    // مغلقاً — مطابق تماماً لمنطق getAvailableSlots تحت (كان قبل يعتبره
    // "مفتوح" بالتقويم فيظهر قابل للاختيار، لكن بعد الاختيار ما تطلع
    // له أي أوقات، وكأن الحفظ "ما اتعيّن" فعلياً).
    // الاستثناء الوحيد: لو الجدول فاضي بالكامل (المحل ما ضبط أوقات
    // العمل نهائياً بعد) نخلي كل الأيام مفتوحة كافتراضي معقول.
    if (workingHours.length === 0) return true;
    return !!wh && wh.is_open !== false;
  };

  const getAvailableSlots = (date) => {
    if (!date) return [];
    const wh = getWorkingHoursForDay(date);
    if (!wh || wh.is_open === false) return [];

    const openMins = timeToMinutes(wh.open_time || '09:00');
    const closeMins = timeToMinutes(wh.close_time || '18:00');
    const slotDur = wh.slot_duration || 30;
    const dateStr = format(date, 'yyyy-MM-dd');

    // Collect booked ranges for this day
    const bookedRanges = bookings
      .filter(b => b.booking_date === dateStr && b.status !== 'cancelled')
      .map(b => ({
        start: timeToMinutes(b.booking_time),
        end: timeToMinutes(b.end_time || minutesToTime(timeToMinutes(b.booking_time) + (b.duration_minutes || 30))),
      }));

    const slots = [];
    for (let t = openMins; t + serviceDuration <= closeMins; t += slotDur) {
      const slotEnd = t + serviceDuration;
      const isBooked = bookedRanges.some(r => !(slotEnd <= r.start || t >= r.end));
      // If today, skip past slots
      const now = new Date();
      if (isSameDay(date, now)) {
        const nowMins = now.getHours() * 60 + now.getMinutes() + 30;
        if (t < nowMins) continue;
      }
      slots.push({ time: minutesToTime(t), available: !isBooked });
    }
    return slots;
  };

  const slots = selectedDate ? getAvailableSlots(selectedDate) : [];

  return (
    <div>
      <h2 className="text-xl font-bold text-[#ece8df] mb-1">اختر الموعد</h2>
      <p className="text-[#bdb8ad] text-sm mb-6">حدد اليوم والوقت المناسب لك</p>

      {/* Calendar */}
      <div className="bg-[#131315] border border-white/10 rounded-none p-4 mb-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(d => subMonths(d, 1))} className="w-8 h-8 rounded-none hover:bg-white/10 flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-[#bdb8ad]" />
          </button>
          <span className="font-bold text-[#ece8df]">
            {format(viewDate, 'MMMM yyyy', { locale: ar })}
          </span>
          <button onClick={() => setViewDate(d => addMonths(d, 1))} className="w-8 h-8 rounded-none hover:bg-white/10 flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-[#bdb8ad]" />
          </button>
        </div>
        {/* Day names */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-xs text-[#8d8a82] font-medium py-1">{d}</div>
          ))}
        </div>
        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} />;
            const available = isDayAvailable(day);
            const selected = selectedDate && isSameDay(day, selectedDate);
            const past = isBefore(day, today);
            return (
              <button
                key={day.toString()}
                disabled={!available}
                onClick={() => { onDateChange(day); onTimeChange(null); }}
                className={cn(
                  "h-9 w-full rounded-none text-sm font-medium transition-all",
                  selected ? "bg-[#ece8df] text-[#0b0b0c]" :
                  past ? "text-white/20 cursor-not-allowed" :
                  available ? "hover:bg-white/10 text-[#ece8df]" :
                  "text-white/20 cursor-not-allowed line-through"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div>
          <p className="text-sm font-medium text-[#bdb8ad] mb-3">
            الأوقات المتاحة ليوم {format(selectedDate, 'EEEE d MMMM', { locale: ar })}
          </p>
          {slots.length === 0 ? (
            <div className="text-center py-8 text-[#8d8a82] bg-[#131315] rounded-none">
              <p className="text-sm">لا توجد أوقات متاحة في هذا اليوم</p>
              <p className="text-xs mt-1">يرجى اختيار يوم آخر</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(slot => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => onTimeChange(slot.time)}
                  className={cn(
                    "py-2.5 rounded-none text-sm font-medium border-2 transition-all",
                    selectedTime === slot.time
                      ? "border-[#ece8df] bg-[#ece8df] text-[#0b0b0c]"
                      : slot.available
                      ? "border-white/10 text-[#ece8df] hover:border-white/30 hover:bg-white/5"
                      : "border-white/5 text-white/25 bg-transparent cursor-not-allowed line-through"
                  )}
                >
                  {slot.time}
                  {!slot.available && <span className="block text-[10px]">محجوز</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}