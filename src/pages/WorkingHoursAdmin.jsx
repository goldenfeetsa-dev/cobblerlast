import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const DAYS = [
  { day: 0, label: 'الأحد' },
  { day: 1, label: 'الاثنين' },
  { day: 2, label: 'الثلاثاء' },
  { day: 3, label: 'الأربعاء' },
  { day: 4, label: 'الخميس' },
  { day: 5, label: 'الجمعة' },
  { day: 6, label: 'السبت' },
];

const DEFAULT_HOURS = DAYS.map(d => ({
  day_of_week: d.day,
  day_name_ar: d.label,
  is_open: ![5].includes(d.day), // Friday closed by default
  open_time: '09:00',
  close_time: '18:00',
  slot_duration: 30,
}));

export default function WorkingHoursAdmin() {
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: existingHours = [] } = useQuery({
    queryKey: ['working-hours-admin'],
    queryFn: () => base44.entities.WorkingHours.list('day_of_week'),
  });

  useEffect(() => {
    if (existingHours.length > 0) {
      setHours(DAYS.map(d => {
        const existing = existingHours.find(wh => wh.day_of_week === d.day);
        return existing || { day_of_week: d.day, day_name_ar: d.label, is_open: true, open_time: '09:00', close_time: '18:00', slot_duration: 30 };
      }));
    }
  }, [existingHours]);

  const update = (dayIndex, field, value) => {
    setHours(prev => prev.map((h, i) => i === dayIndex ? { ...h, [field]: value } : h));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const dayHour of hours) {
      const existing = existingHours.find(wh => wh.day_of_week === dayHour.day_of_week);
      if (existing) {
        await base44.entities.WorkingHours.update(existing.id, dayHour);
      } else {
        await base44.entities.WorkingHours.create(dayHour);
      }
    }
    qc.invalidateQueries({ queryKey: ['working-hours'] });
    qc.invalidateQueries({ queryKey: ['working-hours-admin'] });
    setSaving(false);
    toast({ title: 'تم حفظ أوقات العمل بنجاح' });
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-stone-800">أوقات العمل</h1>
          <p className="text-stone-500 text-sm mt-1">حدد أيام وساعات العمل لمنع التضارب في الحجوزات</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold">
          <Save className="w-4 h-4 ml-2" />
          {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        {hours.map((dayHour, i) => (
          <div key={dayHour.day_of_week} className={cn("p-4 flex items-center gap-4 flex-wrap", !dayHour.is_open && "bg-stone-50 opacity-70")}>
            {/* Toggle */}
            <button
              onClick={() => update(i, 'is_open', !dayHour.is_open)}
              className={cn("relative w-12 h-6 rounded-full transition-colors flex-shrink-0", dayHour.is_open ? "bg-amber-500" : "bg-stone-200")}
            >
              <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", dayHour.is_open ? "right-0.5" : "left-0.5")} />
            </button>

            {/* Day name */}
            <span className={cn("w-20 font-bold text-sm", dayHour.is_open ? "text-stone-800" : "text-stone-400")}>
              {dayHour.day_name_ar}
            </span>

            {dayHour.is_open ? (
              <div className="flex items-center gap-3 flex-wrap flex-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-stone-500 whitespace-nowrap">من</label>
                  <Input
                    type="time"
                    value={dayHour.open_time}
                    onChange={e => update(i, 'open_time', e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-stone-500 whitespace-nowrap">إلى</label>
                  <Input
                    type="time"
                    value={dayHour.close_time}
                    onChange={e => update(i, 'close_time', e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <label className="text-xs text-stone-500">مدة الفترة</label>
                  <select
                    value={dayHour.slot_duration}
                    onChange={e => update(i, 'slot_duration', Number(e.target.value))}
                    className="h-8 text-sm border border-input rounded-md px-2 bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value={15}>15 دقيقة</option>
                    <option value={30}>30 دقيقة</option>
                    <option value={45}>45 دقيقة</option>
                    <option value={60}>ساعة</option>
                  </select>
                </div>
              </div>
            ) : (
              <span className="text-sm text-stone-400 flex-1">مغلق</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}