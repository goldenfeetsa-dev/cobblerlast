/**
 * WorkerRace — سباق الفنيين: ترتيب حسب عدد الطلبات المنجزة ثم الأسرع، مع مدة كل طلب
 * (بداية العمل ← تم الإنجاز) والطلبات الجارية الآن.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Timer } from 'lucide-react';
import { minutesBetween, formatDuration } from '@/lib/workerTiming';

const MEDALS = ['🥇', '🥈', '🥉'];
const ITEM = { shoes: 'حذاء', bag: 'حقيبة', dress: 'فستان', suit: 'بدلة', jacket: 'جاكيت', pants: 'بنطال', shirt: 'قميص', other: 'أخرى' };
const timeFmt = (d) => (d ? new Date(d).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function WorkerRace({ cutoff }) {
  const { data, isLoading } = useQuery({
    queryKey: ['worker-race'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const done = await supabase.from('orders').select('id, order_number, item_type, worker_id, worker_name, work_started_at, work_done_at')
        .not('work_done_at', 'is', null).order('work_done_at', { ascending: false }).limit(2000);
      if (done.error) return { error: true };
      const live = await supabase.from('orders').select('id, order_number, item_type, worker_name, work_started_at')
        .eq('status', 'in_progress').not('work_started_at', 'is', null).order('work_started_at').limit(50);
      return { done: done.data || [], live: live.data || [] };
    },
  });

  const { rows, recent } = useMemo(() => {
    const list = (data?.done || []).filter((o) => !cutoff || new Date(o.work_done_at) >= cutoff);
    const g = {};
    list.forEach((o) => {
      const k = o.worker_id || o.worker_name || 'غير معروف';
      g[k] = g[k] || { name: o.worker_name || 'غير معروف', count: 0, durs: [] };
      g[k].count++;
      const m = minutesBetween(o.work_started_at, o.work_done_at);
      if (m != null) g[k].durs.push(m);
    });
    const rows = Object.values(g).map((w) => ({ ...w, avg: w.durs.length ? w.durs.reduce((a, b) => a + b, 0) / w.durs.length : null, fastest: w.durs.length ? Math.min(...w.durs) : null }))
      .sort((a, b) => b.count - a.count || (a.avg ?? 1e9) - (b.avg ?? 1e9));
    return { rows, recent: list.slice(0, 15) };
  }, [data, cutoff]);

  if (isLoading) return null;
  if (data?.error) {
    return <Card className="mb-6"><CardContent className="p-4 text-sm text-muted-foreground">سباق الفنيين يحتاج تشغيل ملف <b>041_worker_timing.sql</b> في Supabase لتفعيل توقيت العمل.</CardContent></Card>;
  }
  const speedy = rows.filter((r) => r.durs.length >= 3 && r.avg != null).sort((a, b) => a.avg - b.avg)[0];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" />سباق الفنيين</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد طلبات منجزة بتوقيت في هذه الفترة بعد.</p> : (
          <div className="space-y-2">
            {rows.map((w, i) => (
              <div key={w.name + i} className={`flex items-center justify-between rounded-xl border p-3 ${i === 0 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl w-8 text-center">{MEDALS[i] || `#${i + 1}`}</span>
                  <div>
                    <p className="font-bold text-sm">{w.name}{speedy && speedy.name === w.name ? ' ⚡ الأسرع' : ''}</p>
                    <p className="text-xs text-muted-foreground">متوسط الوقت: {formatDuration(w.avg)} · أسرع طلب: {formatDuration(w.fastest)}</p>
                  </div>
                </div>
                <div className="text-center"><p className="text-xl font-black">{w.count}</p><p className="text-[10px] text-muted-foreground">طلب منجز</p></div>
              </div>
            ))}
          </div>
        )}

        {data?.live?.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2 flex items-center gap-1"><Timer className="w-3.5 h-3.5" />جارية الآن</p>
            <div className="space-y-1">
              {data.live.map((o) => (
                <div key={o.id} className="flex justify-between text-xs rounded-lg bg-muted/40 px-3 py-2">
                  <span>{o.order_number} · {ITEM[o.item_type] || ''} · {o.worker_name || 'غير معروف'}</span>
                  <span className="font-bold">{formatDuration(minutesBetween(o.work_started_at, new Date().toISOString()))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="overflow-x-auto">
            <p className="text-xs font-bold mb-2">آخر الطلبات المنجزة ومدة كل واحد</p>
            <table className="w-full text-xs">
              <thead><tr className="text-muted-foreground text-right"><th className="p-1">الطلب</th><th>الفني</th><th>بدأ</th><th>أنجز</th><th>المدة</th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="p-1 font-mono">{o.order_number}</td><td>{o.worker_name || '—'}</td>
                    <td>{timeFmt(o.work_started_at)}</td><td>{timeFmt(o.work_done_at)}</td>
                    <td className="font-bold">{formatDuration(minutesBetween(o.work_started_at, o.work_done_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
