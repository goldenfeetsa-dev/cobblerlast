/**
 * PartnerPortal — بوابة الشركات الشريكة (/partner)
 * الدخول برمز تنشئه الإدارة؛ الشركة ترسل طلباتها وتتابع حالتها لحظياً.
 * كل الاستعلامات عبر دوال Postgres تتحقق من الرمز — لا تخزين إضافي ولا دوال Vercel.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Loader2, LogOut, RefreshCw, Send, PackageCheck, Wrench, Clock, CheckCircle2 } from 'lucide-react';

const KEY = 'partner_code_v1';
const ITEMS = { shoes: 'حذاء', bag: 'حقيبة', jacket: 'جاكيت', suit: 'بدلة', dress: 'فستان', pants: 'بنطال', shirt: 'قميص', other: 'أخرى' };
const STATUS = {
  pending:     { label: 'تم الاستلام',  color: '#b45309', bg: '#fef3c7', Icon: Clock },
  in_progress: { label: 'جاري الإصلاح', color: '#1d4ed8', bg: '#dbeafe', Icon: Wrench },
  ready:       { label: 'جاهز',         color: '#047857', bg: '#d1fae5', Icon: PackageCheck },
  completed:   { label: 'تم التسليم',   color: '#4b5563', bg: '#f3f4f6', Icon: CheckCircle2 },
  cancelled:   { label: 'ملغى',         color: '#b91c1c', bg: '#fee2e2', Icon: Clock },
};
const ERR = {
  unauthorized: 'الرمز غير صالح أو موقوف',
  invalid_name: 'اسم العميل مطلوب',
  invalid_phone: 'رقم الجوال غير صحيح (05XXXXXXXX)',
  invalid_issue: 'اكتب المشكلة',
  invalid_ref: 'الرقم المرجعي طويل',
};

const readCode = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const saveCode = (c) => { try { c ? sessionStorage.setItem(KEY, c) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

export default function PartnerPortal() {
  const [code, setCode] = useState(readCode());
  const [input, setInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', item_type: 'bag', issue: '', partner_ref: '' });
  const [filter, setFilter] = useState('all');

  const load = useCallback(async (c = code, silent = false) => {
    if (!c) return;
    if (!silent) setLoading(true);
    const { data: r } = await supabase.rpc('partner_orders', { p_code: c });
    if (!r?.ok) { saveCode(''); setCode(''); setData(null); if (!silent) toast.error('الرمز غير صالح أو موقوف'); }
    else setData(r);
    setLoading(false);
  }, [code]);

  useEffect(() => { if (code) load(code); }, [code]); // eslint-disable-line
  useEffect(() => { // تحديث تلقائي كل 45 ثانية
    if (!code) return;
    const t = setInterval(() => load(code, true), 45000);
    return () => clearInterval(t);
  }, [code, load]);

  const login = async (e) => {
    e.preventDefault();
    const c = input.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    const { data: r } = await supabase.rpc('partner_login', { p_code: c });
    setLoading(false);
    if (!r?.ok) return toast.error('الرمز غير صالح أو موقوف');
    saveCode(c); setCode(c); setInput('');
  };

  const logout = () => { saveCode(''); setCode(''); setData(null); };

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    const { data: r, error } = await supabase.rpc('partner_submit_order', { p_code: code, p: form });
    setSending(false);
    if (error || !r?.ok) return toast.error(ERR[r?.error] || 'تعذّر إرسال الطلب');
    toast.success(r.created ? `تم إنشاء الطلب ${r.order_number}` : `الطلب موجود مسبقاً: ${r.order_number}`);
    setForm({ customer_name: '', customer_phone: '', item_type: 'bag', issue: '', partner_ref: '' });
    load(code, true);
  };

  const shell = (children) => (
    <div dir="rtl" className="min-h-screen px-4 py-8" style={{ background: '#f6efe3', color: '#2b2118' }}>
      <div className="max-w-3xl mx-auto">{children}</div>
    </div>
  );
  const field = 'w-full rounded-xl border border-amber-900/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-700';

  if (!code || !data) {
    return shell(
      <form onSubmit={login} className="max-w-sm mx-auto mt-16 bg-white rounded-2xl p-6 shadow-sm border border-amber-900/10 space-y-4">
        <h1 className="text-xl font-black text-center">بوابة الشركاء</h1>
        <p className="text-sm text-center text-gray-500">إبرة وخيط الإسكافي — أدخل رمز الدخول الخاص بشركتك</p>
        <input dir="ltr" value={input} onChange={(e) => setInput(e.target.value)} placeholder="XXXXXXXXXXXX"
          className={field + ' text-center tracking-widest font-mono'} autoComplete="off" autoFocus />
        <button disabled={loading} className="w-full py-2.5 rounded-xl font-black text-white disabled:opacity-60" style={{ background: '#7c4a1e' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'دخول'}
        </button>
      </form>
    );
  }

  const orders = (data.orders || []).filter((o) =>
    filter === 'all' ? true : filter === 'open' ? ['pending', 'in_progress', 'ready'].includes(o.status) : o.status === 'completed');

  return shell(
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">{data.name}</h1>
          <p className="text-xs text-gray-500">بوابة الشركاء — إبرة وخيط الإسكافي</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(code)} className="p-2 rounded-xl bg-white border border-amber-900/10" aria-label="تحديث"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={logout} className="p-2 rounded-xl bg-white border border-amber-900/10" aria-label="خروج"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['الطلبات الحالية', data.open], ['المنجزة', data.completed], ['طلبات هذا الشهر', data.month_orders]].map(([l, v]) => (
          <div key={l} className="bg-white rounded-2xl p-4 text-center border border-amber-900/10">
            <div className="text-2xl font-black">{v}</div><div className="text-xs text-gray-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-amber-900/10 space-y-3">
        <h2 className="font-black">إرسال طلب جديد</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={field} placeholder="اسم العميل" value={form.customer_name} maxLength={120} required onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          <input className={field} dir="ltr" placeholder="05XXXXXXXX" inputMode="tel" required value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
          <select className={field} value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
            {Object.entries(ITEMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className={field} placeholder="رقمكم المرجعي (اختياري)" value={form.partner_ref} maxLength={100} onChange={(e) => setForm({ ...form, partner_ref: e.target.value })} />
        </div>
        <textarea className={field} rows={3} placeholder="وصف المشكلة المطلوب إصلاحها" required maxLength={1000} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} />
        <button disabled={sending} className="w-full py-2.5 rounded-xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: '#7c4a1e' }}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> إرسال الطلب</>}
        </button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-black">طلباتكم</h2>
          <div className="flex gap-1 text-xs">
            {[['all', 'الكل'], ['open', 'الحالية'], ['done', 'المنجزة']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className="px-3 py-1 rounded-full border"
                style={filter === k ? { background: '#7c4a1e', color: '#fff', borderColor: '#7c4a1e' } : { background: '#fff', borderColor: '#0002' }}>{l}</button>
            ))}
          </div>
        </div>
        {orders.length === 0 && <p className="text-center text-sm text-gray-500 py-8">لا توجد طلبات</p>}
        {orders.map((o) => {
          const st = STATUS[o.status] || STATUS.pending;
          return (
            <div key={o.order_number} className="bg-white rounded-2xl border border-amber-900/10 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: st.bg }}>
                <span className="font-black text-sm" style={{ color: st.color }}>{o.order_number}</span>
                <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-white" style={{ color: st.color }}>
                  <st.Icon className="w-3.5 h-3.5" />{st.label}
                </span>
              </div>
              <div className="px-4 py-3 text-sm space-y-1">
                <div className="font-bold">{o.customer_name} <span className="text-gray-400 font-normal">· {ITEMS[o.item_type] || 'قطعة'}</span></div>
                <div className="text-gray-600">{o.issue}</div>
                <div className="text-xs text-gray-400 flex flex-wrap gap-x-3">
                  {o.partner_ref && <span>مرجعكم: {o.partner_ref}</span>}
                  <span>{new Date(o.created_at).toLocaleDateString('ar-SA')}</span>
                  {o.delivery_date && <span>موعد التسليم: {o.delivery_date}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
