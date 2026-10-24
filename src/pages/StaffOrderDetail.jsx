/**
 * StaffOrderDetail — صفحة الطلب للفني: اسم العميل، القطع والخدمات، الناقص/الملاحظات (قابلة للتعديل)،
 * الرف، الصور، وزرّا «ابدأ العمل / تم الإنجاز». بدون جوال العميل وبدون أي سعر أو مبلغ.
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/sessionStore';
import { workerPatch, minutesBetween, formatDuration } from '@/lib/workerTiming';
import { notifyOrderReady } from '@/lib/waNotify';
import VoiceNote from '@/components/pos/VoiceNote';
import { ArrowRight, Package, User } from 'lucide-react';

const ITEM = { shoes: 'حذاء 👟', bag: 'حقيبة 👜', dress: 'فستان 👗', suit: 'بدلة 👔', jacket: 'جاكيت 🧥', pants: 'بنطال 👖', shirt: 'قميص 👕', other: 'أخرى 📦' };
const ST = { pending: 'قيد الانتظار', in_progress: 'جارٍ التنفيذ', ready: 'جاهز للاستلام', completed: 'مكتمل', cancelled: 'ملغى' };
const BASE = 'id, order_number, customer_name, item_type, description, notes, status, shelf_location, photos, order_items, created_at, delivery_date';

export default function StaffOrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const session = getSession();
  const [notes, setNotes] = useState('');
  const [shelf, setShelf] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['staff-order', id],
    queryFn: async () => {
      let r = await supabase.from('orders').select(`${BASE}, work_started_at, work_done_at, worker_name`).eq('id', id).maybeSingle();
      if (r.error) r = await supabase.from('orders').select(BASE).eq('id', id).maybeSingle(); // قبل تشغيل 041
      return r.data;
    },
  });
  useEffect(() => { if (order) { setNotes(order.notes || ''); setShelf(order.shelf_location || ''); } }, [order]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['staff-order', id] }); qc.invalidateQueries({ queryKey: ['staff-orders'] }); };
  const patch = async (fields, okMsg) => {
    setSaving(true);
    const { error } = await supabase.from('orders').update(fields).eq('id', id);
    setSaving(false);
    if (error) return toast.error('تعذّر الحفظ');
    toast.success(okMsg); refresh();
    if (fields.status === 'ready') notifyOrderReady(id);
  };

  if (isLoading) return <div className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>;
  if (!order) return <div className="p-6 text-center text-sm">الطلب غير موجود. <Link to="/staff" className="underline">رجوع</Link></div>;

  const next = order.status === 'pending' ? { s: 'in_progress', l: 'ابدأ العمل ▶', c: '#3b82f6' } : order.status === 'in_progress' ? { s: 'ready', l: 'تم الإنجاز ✅', c: '#10b981' } : null;
  const dur = minutesBetween(order.work_started_at, order.work_done_at || (order.status === 'in_progress' ? new Date().toISOString() : null));

  return (
    <div className="max-w-2xl mx-auto space-y-4" dir="rtl">
      <Link to="/staff" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowRight className="w-4 h-4" />مهامي</Link>

      <div className="rounded-2xl border bg-card p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{order.order_number}</span>
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-muted">{ST[order.status] || order.status}</span>
        </div>
        <div className="flex items-center gap-2 text-xl font-black"><User className="w-5 h-5" />{order.customer_name || 'بدون اسم'}</div>
        <div className="text-sm text-muted-foreground">{ITEM[order.item_type] || 'قطعة'}{order.delivery_date ? ` · التسليم ${order.delivery_date}` : ''}</div>
        {dur != null && <div className="text-sm">⏱ مدة العمل: <b>{formatDuration(dur)}</b></div>}
      </div>

      {Array.isArray(order.order_items) && order.order_items.length > 0 && (
        <div className="space-y-2">
          {order.order_items.map((it, i) => (
            <div key={i} className="rounded-xl border bg-blue-50/60 dark:bg-blue-950/20 p-3 text-sm">
              <div className="font-bold">قطعة {i + 1} — {ITEM[it.item_type] || it.item_type}</div>
              {it.services?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{it.services.map((s, k) => <span key={k} className="text-xs bg-white dark:bg-background px-2 py-0.5 rounded-full border">{s}</span>)}</div>}
              {it.description && <p className="text-xs mt-1 text-muted-foreground">{it.description}</p>}
            </div>
          ))}
        </div>
      )}

      {order.description && <div className="rounded-xl border p-3 text-sm whitespace-pre-wrap">{order.description}</div>}

      {order.photos?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">{order.photos.map((u, i) => <img key={i} src={u} alt="صورة" loading="lazy" className="w-24 h-24 rounded-lg object-cover border shrink-0" />)}</div>
      )}

      <div className="rounded-xl border p-3 space-y-2">
        <label className="text-sm font-bold">الناقص / الملاحظات</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-lg border px-3 py-2 text-sm bg-background" placeholder="مثال: ناقص الشكشك — العميل يريد تغييره" />
        <button disabled={saving || notes === (order.notes || '')} onClick={() => patch({ notes: notes.slice(0, 2000) }, 'تم حفظ الملاحظات')} className="w-full py-2.5 rounded-lg bg-amber-700 text-white text-sm font-black disabled:opacity-40">حفظ الملاحظات</button>
      </div>

      <div className="rounded-xl border p-3 space-y-2">
        <label className="text-sm font-bold flex items-center gap-1"><Package className="w-4 h-4" />الرف</label>
        <div className="flex gap-2">
          <input value={shelf} onChange={(e) => setShelf(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background" placeholder="مثال: A3" />
          <button disabled={saving || shelf === (order.shelf_location || '')} onClick={() => patch({ shelf_location: shelf.slice(0, 30) }, 'تم حفظ الرف')} className="px-4 rounded-lg bg-amber-700 text-white text-sm font-black disabled:opacity-40">حفظ</button>
        </div>
      </div>

      {['pending', 'in_progress', 'ready'].includes(order.status) && <VoiceNote order={order} onSaved={refresh} />}

      {next && (
        <button disabled={saving} onClick={() => patch({ status: next.s, ...workerPatch(session) }, next.s === 'ready' ? 'تم الإنجاز ✅' : 'بدأ العمل')} className="w-full py-3.5 rounded-xl text-white font-black text-base disabled:opacity-60" style={{ background: next.c }}>{next.l}</button>
      )}
    </div>
  );
}
