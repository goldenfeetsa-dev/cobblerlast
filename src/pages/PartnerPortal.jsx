/**
 * PartnerPortal — بوابة الشركاء (/partner): Coach · Gucci وغيرهم
 * الدخول برمز تنشئه الإدارة. كل الاستعلامات عبر دوال Postgres تتحقق من الرمز.
 * تتبع دقيق: 4 مراحل بتواريخها، موعد التسليم المتوقع، تنبيه التأخير، بحث وتصدير.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Loader2, LogOut, RefreshCw, Send, Search, Download, ChevronDown, Check, AlertTriangle, Plus } from 'lucide-react';

const KEY = 'partner_code_v1';
const INK = '#ece8df', GOLD = '#c9a84c', HAIR = 'rgba(255,255,255,0.1)', MUTED = '#8d8a82', BG = '#0b0b0c', CARD = '#111113';
const ITEMS = { shoes: 'حذاء', bag: 'حقيبة', jacket: 'جاكيت', suit: 'بدلة', dress: 'فستان', pants: 'بنطال', shirt: 'قميص', other: 'أخرى' };
const STAGES = [['pending', 'استلام القطعة'], ['in_progress', 'في الورشة'], ['ready', 'جاهزة'], ['completed', 'تم التسليم']];
const STATUS_LABEL = { pending: 'تم الاستلام', in_progress: 'قيد الإصلاح', ready: 'جاهزة للتسليم', completed: 'تم التسليم', cancelled: 'ملغاة' };
const ERR = {
  unauthorized: 'الرمز غير صالح أو موقوف', invalid_name: 'اسم العميل مطلوب', invalid_phone: 'رقم الجوال غير صحيح (05XXXXXXXX)',
  invalid_issue: 'اكتب المشكلة', invalid_ref: 'الرقم المرجعي طويل',
};
const readCode = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const saveCode = (c) => { try { c ? sessionStorage.setItem(KEY, c) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
const fmt = (d) => (d ? new Date(d).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const fmtT = (d) => (d ? new Date(d).toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);
const field = 'w-full bg-transparent px-4 py-3 text-sm outline-none focus:border-[#ece8df]';
const fstyle = { border: `1px solid ${HAIR}`, color: INK };

function stageIndex(o) { const i = STAGES.findIndex(([k]) => k === o.status); return i < 0 ? 0 : i; }
function stageTimes(o) { return [o.created_at, o.work_started_at, o.ready_at || o.work_done_at, o.delivered_at]; }
function eta(o, turnaround) {
  if (o.delivery_date) return new Date(o.delivery_date);
  if (turnaround) return new Date(new Date(o.created_at).getTime() + turnaround * 864e5);
  return null;
}
const isOpen = (o) => ['pending', 'in_progress', 'ready'].includes(o.status);

function Tracker({ o }) {
  if (o.status === 'cancelled') return <p className="text-xs" style={{ color: '#f87171' }}>تم إلغاء هذا الطلب</p>;
  const cur = stageIndex(o), times = stageTimes(o);
  return (
    <ol className="grid grid-cols-4 gap-1 pt-1" aria-label="مراحل الطلب">
      {STAGES.map(([k, label], i) => {
        const done = i < cur || (i === cur && k === 'completed'), active = i === cur && k !== 'completed';
        return (
          <li key={k} className="relative text-center">
            <div className="absolute top-3 h-px" style={{ insetInlineStart: '-50%', width: '100%', background: i <= cur ? GOLD : HAIR, display: i === 0 ? 'none' : 'block' }} />
            <div className="relative mx-auto w-6 h-6 rounded-full flex items-center justify-center" style={{ background: done ? GOLD : BG, border: `1px solid ${done || active ? GOLD : HAIR}`, boxShadow: active ? `0 0 14px ${GOLD}80` : 'none' }}>
              {done ? <Check className="w-3.5 h-3.5" style={{ color: BG }} /> : active ? <span className="w-2 h-2 rounded-full" style={{ background: GOLD }} /> : null}
            </div>
            <div className="text-[11px] mt-2" style={{ color: i <= cur ? INK : MUTED }}>{label}</div>
            <div className="text-[10px]" style={{ color: MUTED }}>{i <= cur ? fmtT(times[i]) || '' : ''}</div>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({ o, turnaround }) {
  const [open, setOpen] = useState(false);
  const e = eta(o, turnaround), late = isOpen(o) && e && e.getTime() < Date.now() - 864e5 * 0;
  return (
    <article style={{ border: `1px solid ${late ? '#7f1d1d' : HAIR}`, background: CARD }}>
      <button onClick={() => setOpen(!open)} className="w-full text-start p-4 flex items-center gap-3" aria-expanded={open}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm" style={{ color: GOLD }}>{o.order_number}</span>
            <span className="text-[11px] px-2 py-0.5" style={{ border: `1px solid ${HAIR}`, color: INK }}>{STATUS_LABEL[o.status] || o.status}</span>
            {late && <span className="text-[11px] flex items-center gap-1" style={{ color: '#f87171' }}><AlertTriangle className="w-3 h-3" />تجاوز الموعد المتوقع</span>}
          </div>
          <div className="mt-1 text-sm truncate" style={{ color: INK }}>{o.customer_name} <span style={{ color: MUTED }}>· {ITEMS[o.item_type] || 'قطعة'}{o.quantity > 1 ? ` ×${o.quantity}` : ''}</span></div>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: MUTED }} />
      </button>
      <div className="px-4 pb-4"><Tracker o={o} /></div>
      {open && (
        <div className="px-4 pb-4 pt-3 text-sm space-y-2" style={{ borderTop: `1px solid ${HAIR}` }}>
          <p style={{ color: '#bdb8ad' }}>{o.issue}</p>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs" style={{ color: MUTED }}>
            <dt>تاريخ الاستلام</dt><dd style={{ color: INK }}>{fmt(o.created_at)}</dd>
            {e && isOpen(o) && (<><dt>موعد التسليم المتوقع</dt><dd style={{ color: late ? '#f87171' : INK }}>{fmt(e)}</dd></>)}
            {o.delivered_at && (<><dt>تاريخ التسليم</dt><dd style={{ color: INK }}>{fmt(o.delivered_at)}</dd></>)}
            {o.partner_ref && (<><dt>مرجعكم</dt><dd style={{ color: INK }}>{o.partner_ref}</dd></>)}
            {o.photo_count > 0 && (<><dt>صور موثّقة</dt><dd style={{ color: INK }}>{o.photo_count}</dd></>)}
          </dl>
        </div>
      )}
    </article>
  );
}

export default function PartnerPortal() {
  const [code, setCode] = useState(readCode());
  const [input, setInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', item_type: 'bag', issue: '', partner_ref: '' });
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');

  const load = useCallback(async (c = code, silent = false) => {
    if (!c) return;
    if (!silent) setLoading(true);
    const { data: r } = await supabase.rpc('partner_orders', { p_code: c });
    if (!r?.ok) { saveCode(''); setCode(''); setData(null); if (!silent) toast.error('الرمز غير صالح أو موقوف'); }
    else setData(r);
    setLoading(false);
  }, [code]);
  useEffect(() => { if (code) load(code); }, [code]); // eslint-disable-line
  useEffect(() => { if (!code) return; const t = setInterval(() => load(code, true), 45000); return () => clearInterval(t); }, [code, load]);

  const login = async (e) => {
    e.preventDefault();
    const c = input.trim().toUpperCase(); if (!c) return;
    setLoading(true);
    const { data: r } = await supabase.rpc('partner_login', { p_code: c });
    setLoading(false);
    if (!r?.ok) return toast.error('الرمز غير صالح أو موقوف');
    saveCode(c); setCode(c); setInput('');
  };
  const logout = () => { saveCode(''); setCode(''); setData(null); };
  const submit = async (e) => {
    e.preventDefault(); setSending(true);
    const { data: r, error } = await supabase.rpc('partner_submit_order', { p_code: code, p: form });
    setSending(false);
    if (error || !r?.ok) return toast.error(ERR[r?.error] || 'تعذّر إرسال الطلب');
    toast.success(r.created ? `تم إنشاء الطلب ${r.order_number}` : `الطلب موجود مسبقاً: ${r.order_number}`);
    setForm({ customer_name: '', customer_phone: '', item_type: 'bag', issue: '', partner_ref: '' });
    setShowForm(false); load(code, true);
  };

  const all = data?.orders || [];
  const turnaround = data?.turnaround_days;
  const counts = useMemo(() => ({
    open: all.filter(isOpen).length, ready: all.filter((o) => o.status === 'ready').length,
    late: all.filter((o) => { const e = eta(o, turnaround); return isOpen(o) && e && e.getTime() < Date.now(); }).length,
    done: all.filter((o) => o.status === 'completed').length,
  }), [all, turnaround]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((o) => (filter === 'all' || (filter === 'open' && isOpen(o)) || (filter === 'ready' && o.status === 'ready') || (filter === 'done' && o.status === 'completed')) &&
      (!s || [o.order_number, o.customer_name, o.partner_ref, o.issue].some((v) => String(v || '').toLowerCase().includes(s))));
  }, [all, filter, q]);

  const exportCsv = () => {
    const rows = [['رقم الطلب', 'مرجعكم', 'العميل', 'القطعة', 'الحالة', 'تاريخ الاستلام', 'التسليم'],
      ...shown.map((o) => [o.order_number, o.partner_ref || '', o.customer_name, ITEMS[o.item_type] || '', STATUS_LABEL[o.status] || o.status, o.created_at?.slice(0, 10), (o.delivered_at || '').slice(0, 10)])];
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'orders.csv'; a.click();
  };

  const head = (<Helmet><title>بوابة الشركاء | إبرة وخيط الإسكافي</title><meta name="robots" content="noindex,nofollow" /></Helmet>);
  const mark = <img src="/images/cobblers-official-mark-white.png" alt="إبرة وخيط الإسكافي" className="h-10 w-auto" />;

  if (!code || !data) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center px-5" style={{ background: BG, color: INK }}>
        {head}
        <form onSubmit={login} className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-8">{mark}</div>
          <p className="text-xs tracking-[0.35em] mb-3" style={{ color: GOLD }}>PARTNER PORTAL</p>
          <h1 className="text-2xl font-light mb-2">بوابة الشركاء</h1>
          <p className="text-sm font-light mb-8" style={{ color: MUTED }}>تتبّع دقيق لكل قطعة، من الاستلام حتى التسليم.</p>
          <input dir="ltr" value={input} onChange={(e) => setInput(e.target.value)} placeholder="رمز الدخول" autoComplete="off" autoFocus className={field + ' text-center tracking-[0.3em] font-mono mb-3'} style={fstyle} />
          <button disabled={loading} className="w-full min-h-[48px] font-semibold disabled:opacity-60" style={{ background: INK, color: BG }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'دخول'}
          </button>
          <p className="text-[11px] mt-6" style={{ color: MUTED }}>الرمز يصلك من إدارة إبرة وخيط. للمساعدة تواصل مع مدير حسابك.</p>
        </form>
      </div>
    );
  }

  const stats = [['قطع قيد التنفيذ', counts.open], ['جاهزة للتسليم', counts.ready], ['متأخرة', counts.late], ['متوسط مدة الإنجاز', data.avg_days != null ? `${data.avg_days} يوم` : '—']];
  return (
    <div dir="rtl" className="min-h-screen" style={{ background: BG, color: INK }}>
      {head}
      <header className="h-16 px-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${HAIR}` }}>
        {mark}
        <div className="flex gap-2">
          <button onClick={() => load(code)} className="w-10 h-10 flex items-center justify-center" style={{ border: `1px solid ${HAIR}` }} aria-label="تحديث"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={logout} className="w-10 h-10 flex items-center justify-center" style={{ border: `1px solid ${HAIR}` }} aria-label="خروج"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-10 space-y-8">
        <section>
          <p className="text-xs tracking-[0.35em] mb-3" style={{ color: GOLD }}>OFFICIAL PARTNER</p>
          <h1 className="text-3xl sm:text-4xl font-light">{data.name}</h1>
          <p className="text-sm font-light mt-2" style={{ color: MUTED }}>{turnaround ? `مدة الإنجاز المتفق عليها: ${turnaround} أيام عمل · ` : ''}يتجدد تلقائياً كل 45 ثانية</p>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-px" style={{ background: HAIR }}>
          {stats.map(([l, v]) => (
            <div key={l} className="p-5" style={{ background: BG }}>
              <div className="text-2xl font-light" style={{ color: l === 'متأخرة' && v > 0 ? '#f87171' : INK }}>{v}</div>
              <div className="text-xs mt-1" style={{ color: MUTED }}>{l}</div>
            </div>
          ))}
        </section>

        <section>
          <button onClick={() => setShowForm(!showForm)} className="w-full min-h-[48px] flex items-center justify-center gap-2 text-sm font-semibold" style={{ border: `1px solid ${GOLD}`, color: GOLD }}>
            <Plus className="w-4 h-4" />{showForm ? 'إغلاق' : 'إرسال طلب جديد'}
          </button>
          {showForm && (
            <form onSubmit={submit} className="mt-3 p-5 space-y-3" style={{ border: `1px solid ${HAIR}`, background: CARD }}>
              <div className="grid sm:grid-cols-2 gap-3">
                <input className={field} style={fstyle} placeholder="اسم العميل" value={form.customer_name} maxLength={120} required onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                <input className={field} style={fstyle} dir="ltr" placeholder="05XXXXXXXX" inputMode="tel" required value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
                <select className={field} style={{ ...fstyle, background: BG }} value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
                  {Object.entries(ITEMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input className={field} style={fstyle} placeholder="رقمكم المرجعي (اختياري)" value={form.partner_ref} maxLength={100} onChange={(e) => setForm({ ...form, partner_ref: e.target.value })} />
              </div>
              <textarea className={field} style={fstyle} rows={3} placeholder="وصف المطلوب إصلاحه" required maxLength={1000} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} />
              <button disabled={sending} className="w-full min-h-[48px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: INK, color: BG }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />إرسال</>}
              </button>
            </form>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {[['open', `الحالية (${counts.open})`], ['ready', `جاهزة (${counts.ready})`], ['done', `المنجزة (${counts.done})`], ['all', 'الكل']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className="shrink-0 px-4 h-9 text-xs font-semibold" style={filter === k ? { background: INK, color: BG } : { border: `1px solid ${HAIR}`, color: '#bdb8ad' }}>{l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3" style={{ color: MUTED }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برقم الطلب أو العميل أو مرجعكم" className={field + ' ps-10'} style={fstyle} />
            </div>
            <button onClick={exportCsv} className="px-4 flex items-center gap-2 text-xs" style={{ border: `1px solid ${HAIR}`, color: '#bdb8ad' }}><Download className="w-4 h-4" />CSV</button>
          </div>
          {shown.length === 0 && <p className="text-center text-sm py-12" style={{ color: MUTED }}>لا توجد طلبات مطابقة</p>}
          <div className="space-y-3">{shown.map((o) => <OrderCard key={o.order_number} o={o} turnaround={turnaround} />)}</div>
        </section>
      </main>
    </div>
  );
}
