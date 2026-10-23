/** PartnerAccount — حساب شركة واحدة: طلبات، استلام شنط، أسعار، فواتير ضريبية */
import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { Loader2, ArrowRight, Printer, Plus, Trash2, Receipt, Barcode, Wallet, FileText } from 'lucide-react';
import { getSession } from '@/lib/sessionStore';
import { isFullAdmin } from '@/lib/roles';
import { partnerApi } from './PartnersAdmin';

const money = (n) => `${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d) => (d ? String(d).slice(0, 10) : '—');
const api = (id, action, method = 'GET', body) =>
  partnerApi(`/api/secure/data?resource=partners&action=${action}&id=${id}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });

const isInProgress = (o) => ['pending', 'in_progress', 'ready'].includes(o.status);
const isDelivered = (o) => o.status === 'completed';
const isPaid = (o) => o.payment_status === 'paid';
const isInvoiceable = (o) => isDelivered(o) && !isPaid(o) && !o.partner_invoice_id && Number(o.total_price) > 0;

const FILTERS = [
  ['all', 'الكل', () => true],
  ['unpaid', 'غير مسدّد', (o) => !isPaid(o) && o.status !== 'cancelled'],
  ['paid', 'مسدّد', isPaid],
  ['progress', 'قيد التجهيز', (o) => isInProgress(o)],
  ['delivered', 'تم التسليم', isDelivered],
];

function statusBadge(o) {
  if (o.status === 'cancelled') return ['ملغى', '#6b7280', '#f3f4f6'];
  if (isPaid(o)) return ['مسدّد', '#047857', '#d1fae5'];
  if (isDelivered(o)) return ['مسلَّم — بانتظار السداد', '#b45309', '#fef3c7'];
  return ['قيد التجهيز', '#1d4ed8', '#dbeafe'];
}

export default function PartnerAccount() {
  const { id } = useParams();
  const qc = useQueryClient();
  const canEdit = isFullAdmin(getSession()?.role);
  const [tab, setTab] = useState('orders');
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(() => new Set());
  const [invoiceView, setInvoiceView] = useState(null);
  const [showStatement, setShowStatement] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: ['partner-detail', id], queryFn: () => api(id, 'detail') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['partner-detail', id] });

  const issue = useMutation({
    mutationFn: (order_ids) => api(id, 'invoice', 'POST', { order_ids, payment_method: 'online' }),
    onSuccess: (r) => {
      setSel(new Set()); refresh(); qc.invalidateQueries({ queryKey: ['partners-admin'] });
      if (r.zatca?.status === 'ERROR') toast.warning('تم السداد وإصدار الفاتورة، لكن الإبلاغ لزاتكا تعثّر وسيُعاد تلقائياً');
      else toast.success('تم السداد وإصدار الفاتورة الضريبية');
      if (r.invoice) setInvoiceView(r.invoice);
    },
    onError: (e) => toast.error(e.message),
  });

  const orders = data?.orders || [];
  const today = data?.today || new Date().toISOString().slice(0, 10);
  const isDue = (o) => isInvoiceable(o) && o.payment_due_date && String(o.payment_due_date).slice(0, 10) <= today;
  const dueOrders = orders.filter(isDue);
  const dueTotal = dueOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const shown = useMemo(() => orders.filter((FILTERS.find((f) => f[0] === filter) || FILTERS[0])[2]), [orders, filter]);
  const selected = orders.filter((o) => sel.has(o.id));
  const selTotal = selected.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const selInvoiceable = selected.length > 0 && selected.every(isInvoiceable);

  const toggle = (o) => setSel((s) => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; });
  const openLabels = (ids) => { if (ids.length) window.open(`/barcode/${ids[0]}?ids=${ids.join(',')}`, '_blank'); };

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-20" />;
  if (error) return <div dir="rtl" className="p-6 text-red-600">{error.message}</div>;
  const p = data.partner;

  return (
    <div dir="rtl" className="max-w-4xl mx-auto p-4 space-y-4">
      <Link to="/admin/partners" className="text-sm text-gray-500 flex items-center gap-1"><ArrowRight className="w-4 h-4" />كل الشركات</Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-black">{p.name}</h1>
          <p className="text-xs text-gray-500">
            رقم ضريبي: <span dir="ltr">{p.vat_number || 'غير مُدخل'}</span> · التسليم {p.turnaround_days} أيام · السداد بعد الاستلام بـ {p.payment_terms_days} يوم
          </p>
        </div>
        <button onClick={() => setShowStatement(true)} className="px-3 py-2 rounded-xl border bg-white text-sm font-bold flex items-center gap-1 shrink-0"><FileText className="w-4 h-4" />كشف حساب</button>
      </div>

      {/* زر مستحق السداد الآن */}
      <button
        onClick={() => { setTab('orders'); setFilter('unpaid'); setSel(new Set(dueOrders.map((o) => o.id))); }}
        className="w-full rounded-2xl border-2 border-red-300 bg-red-50 p-3 text-right flex items-center justify-between">
        <span className="flex items-center gap-2 text-red-700 font-bold text-sm"><Wallet className="w-5 h-5" />مستحق السداد الآن ({dueOrders.length} شنطة مرّ عليها {p.payment_terms_days} يوم من الاستلام)</span>
        <span className="text-lg font-black text-red-700">{money(dueTotal)} ر.س</span>
      </button>

      <div className="flex gap-1 overflow-x-auto border-b">
        {[['orders', 'الطلبات'], ['intake', 'استلام شنط'], ['prices', 'الأسعار'], ['invoices', `الفواتير (${(data.invoices || []).length})`], ['info', 'بيانات الشركة']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-bold whitespace-nowrap border-b-2 ${tab === k ? 'border-amber-700 text-amber-800' : 'border-transparent text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1 rounded-full text-xs font-bold border ${filter === k ? 'bg-amber-800 text-white border-amber-800' : 'bg-white'}`}>{l}</button>
            ))}
          </div>

          {selected.length > 0 && (
            <div className="sticky top-2 z-10 rounded-2xl bg-white border-2 border-amber-600 shadow p-3 flex flex-wrap items-center gap-2">
              <div className="flex-1 text-sm">
                <b>{selected.length}</b> محدد — الإجمالي شامل الضريبة: <b className="text-base">{money(selTotal)} ر.س</b>
              </div>
              <button onClick={() => openLabels(selected.map((o) => o.id))} className="px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1"><Barcode className="w-4 h-4" />طباعة باركودات</button>
              <button disabled={!selInvoiceable || issue.isPending} onClick={() => issue.mutate(selected.map((o) => o.id))}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold flex items-center gap-1 disabled:opacity-40" style={{ background: '#7c4a1e' }}>
                {issue.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}إصدار فاتورة وسداد
              </button>
              <button onClick={() => setSel(new Set())} className="text-xs underline text-gray-500">إلغاء</button>
              {!selInvoiceable && <div className="w-full text-xs text-amber-700">الفوترة تحتاج شنطاً مسلَّمة وغير مسدّدة ومسعّرة فقط.</div>}
            </div>
          )}

          {shown.length === 0 && <p className="text-center text-sm text-gray-500 py-8">لا توجد طلبات</p>}
          {shown.map((o) => {
            const [label, color, bg] = statusBadge(o);
            const due = isDue(o);
            return (
              <div key={o.id} className={`rounded-2xl border bg-white p-3 flex gap-3 items-start ${due ? 'border-red-300' : ''}`}>
                <input type="checkbox" className="mt-1.5 w-5 h-5" checked={sel.has(o.id)} onChange={() => toggle(o)} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm" dir="ltr">{o.order_number}</span>
                    {o.partner_ref && <span className="text-xs text-gray-600">{o.partner_ref}</span>}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>{label}</span>
                    {due && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">استحق السداد</span>}
                  </div>
                  <div className="text-xs text-gray-600 truncate">{o.description}</div>
                  <div className="text-[11px] text-gray-500">
                    استلام: {day(o.created_at)} · تسليم متوقع: {day(o.delivery_date)}
                    {o.delivered_at && <> · سُلّم: {day(o.delivered_at)}</>}
                    {o.payment_due_date && !isPaid(o) && <> · السداد: {day(o.payment_due_date)}</>}
                  </div>
                </div>
                <div className="text-left shrink-0 space-y-1">
                  {Number(o.total_price) > 0
                    ? <div className="font-black text-sm">{money(o.total_price)}</div>
                    : <div className="text-[11px] font-bold text-amber-700">بانتظار التسعير</div>}
                  {isInvoiceable(o) && (
                    <button disabled={issue.isPending} onClick={() => issue.mutate([o.id])} className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: '#047857' }}>سداد</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'intake' && <Intake partnerId={id} services={data.services} canEdit={canEdit} orders={orders} onDone={() => { refresh(); qc.invalidateQueries({ queryKey: ['partners-admin'] }); }} openLabels={openLabels} />}
      {tab === 'prices' && <Prices partnerId={id} services={data.services} canEdit={canEdit} onDone={refresh} />}
      {tab === 'invoices' && (
        <div className="space-y-2">
          {(data.invoices || []).length === 0 && <p className="text-center text-sm text-gray-500 py-8">لا توجد فواتير بعد</p>}
          {(data.invoices || []).map((i) => (
            <button key={i.id} onClick={() => setInvoiceView(i)} className="w-full text-right rounded-2xl border bg-white p-3 flex justify-between items-center">
              <div>
                <div className="font-bold text-sm" dir="ltr">{i.invoice_number}</div>
                <div className="text-xs text-gray-500">{day(i.created_at)} · {i.order_count} شنطة · {i.zatca_status === 'REPORTED' ? 'مُبلَّغة لزاتكا' : 'بانتظار الإبلاغ'}</div>
              </div>
              <div className="font-black">{money(i.total)} ر.س</div>
            </button>
          ))}
        </div>
      )}
      {tab === 'info' && <Info partner={p} canEdit={canEdit} partnerId={id} onDone={refresh} />}

      {showStatement && <StatementModal data={data} onClose={() => setShowStatement(false)} />}
      {invoiceView && <InvoiceModal inv={invoiceView} onClose={() => setInvoiceView(null)} />}
    </div>
  );
}

function Intake({ partnerId, services, canEdit, orders, onDone, openLabels }) {
  const active = services.filter((s) => s.is_active);
  const blank = () => ({ label: '', notes: '', picked: {} });
  const [bags, setBags] = useState([blank()]);
  const unpriced = orders.filter((o) => Number(o.total_price) === 0 && !o.partner_invoice_id && o.status !== 'cancelled');
  const save = useMutation({
    mutationFn: () => api(partnerId, 'intake', 'POST', {
      bags: bags.map((b) => ({ label: b.label, notes: b.notes, services: Object.entries(b.picked).filter(([, q]) => q > 0).map(([service_id, qty]) => ({ service_id, qty })) })),
    }),
    onSuccess: (created) => {
      toast.success(`تم تسجيل ${created.length} شنطة — موعد التسليم ${day(created[0]?.delivery_date)}`);
      setBags([blank()]); onDone(); openLabels(created.map((c) => c.id));
    },
    onError: (e) => toast.error(e.message),
  });
  if (!canEdit) return <p className="text-sm text-gray-500">الاستلام متاح للإدارة فقط.</p>;
  const upd = (i, patch) => setBags((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const valid = bags.every((b) => Object.values(b.picked).some((q) => q > 0));
  const priceOf = (s) => Number(s.price) || 0;
  const bagTotal = (b) => active.reduce((t, s) => t + (b.picked[s.id] || 0) * priceOf(s), 0) * 1.15;
  const grand = bags.reduce((t, b) => t + bagTotal(b), 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">كل شنطة = طلب وباركود مستقل. تاريخ التسليم يُحسب تلقائياً (اليوم + مدة الشركة)، والأسعار تُؤخذ من قائمة الشركة على السيرفر.</p>
      {bags.map((b, i) => (
        <div key={i} className="rounded-2xl border bg-white p-3 space-y-2">
          <div className="flex gap-2">
            <input value={b.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="وصف/رقم الشنطة (مثال: شنطة سوداء #12)" className="flex-1 rounded-xl border px-3 py-2 text-sm" maxLength={100} />
            {bags.length > 1 && <button onClick={() => setBags(bags.filter((_, j) => j !== i))} className="p-2 text-red-600"><Trash2 className="w-4 h-4" /></button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {active.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm rounded-lg border px-2 py-1.5">
                <input type="checkbox" checked={(b.picked[s.id] || 0) > 0} onChange={(e) => upd(i, { picked: { ...b.picked, [s.id]: e.target.checked ? 1 : 0 } })} />
                <span className="flex-1">{s.name_ar}</span>
                <span className={`text-xs ${priceOf(s) > 0 ? 'text-gray-500' : 'text-red-600 font-bold'}`}>{priceOf(s) > 0 ? money(priceOf(s)) : 'بدون سعر'}</span>
                {(b.picked[s.id] || 0) > 0 && (
                  <input type="number" min={1} max={50} value={b.picked[s.id]} onChange={(e) => upd(i, { picked: { ...b.picked, [s.id]: Math.max(1, parseInt(e.target.value, 10) || 1) } })} className="w-14 border rounded px-1 text-center" />
                )}
              </label>
            ))}
          </div>
          <input value={b.notes} onChange={(e) => upd(i, { notes: e.target.value })} placeholder="ملاحظات" className="w-full rounded-xl border px-3 py-2 text-sm" maxLength={500} />
          <div className="text-xs text-gray-500">شامل الضريبة (تقديري): <b>{money(bagTotal(b))}</b> ر.س</div>
        </div>
      ))}
      <div className="flex gap-2 items-center">
        <button onClick={() => setBags([...bags, blank()])} className="px-3 py-2 rounded-xl border text-sm font-bold flex items-center gap-1"><Plus className="w-4 h-4" />شنطة أخرى</button>
        <div className="flex-1 text-sm text-left">الإجمالي: <b>{money(grand)}</b> ر.س</div>
        <button disabled={!valid || save.isPending} onClick={() => save.mutate()} className="px-4 py-2 rounded-xl text-white text-sm font-bold flex items-center gap-1 disabled:opacity-40" style={{ background: '#7c4a1e' }}>
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}تسجيل وطباعة الباركودات
        </button>
      </div>

      {unpriced.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 space-y-2">
          <div className="font-bold text-sm">طلبات أرسلتها الشركة من البوابة وتحتاج تحديد الخدمات والتسعير</div>
          {unpriced.map((o) => <Reprice key={o.id} order={o} services={active} partnerId={partnerId} onDone={onDone} />)}
        </div>
      )}
    </div>
  );
}

function Reprice({ order, services, partnerId, onDone }) {
  const [picked, setPicked] = useState({});
  const m = useMutation({
    mutationFn: () => api(partnerId, 'reprice', 'POST', { order_id: order.id, services: Object.entries(picked).filter(([, q]) => q > 0).map(([service_id, qty]) => ({ service_id, qty })) }),
    onSuccess: () => { toast.success('تم التسعير'); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="bg-white rounded-xl p-2 space-y-1">
      <div className="text-xs"><b dir="ltr">{order.order_number}</b> — {order.description}</div>
      <div className="flex flex-wrap gap-1">
        {services.map((s) => (
          <label key={s.id} className="text-xs border rounded-full px-2 py-1 flex items-center gap-1">
            <input type="checkbox" checked={(picked[s.id] || 0) > 0} onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked ? 1 : 0 })} />{s.name_ar}
          </label>
        ))}
      </div>
      <button disabled={m.isPending || !Object.values(picked).some((q) => q > 0)} onClick={() => m.mutate()} className="text-xs font-bold px-3 py-1 rounded-full text-white disabled:opacity-40" style={{ background: '#7c4a1e' }}>تسعير</button>
    </div>
  );
}

function Prices({ partnerId, services, canEdit, onDone }) {
  const [custom, setCustom] = useState(() => Object.fromEntries(services.map((s) => [s.id, s.custom_price ?? ''])));
  const [base, setBase] = useState(() => Object.fromEntries(services.map((s) => [s.id, s.base_price])));
  const saveCustom = useMutation({
    mutationFn: () => api(partnerId, 'set-prices', 'POST', { prices: services.map((s) => ({ service_id: s.id, price: custom[s.id] })) }),
    onSuccess: () => { toast.success('تم حفظ أسعار الشركة'); onDone(); }, onError: (e) => toast.error(e.message),
  });
  const saveBase = useMutation({
    mutationFn: (s) => partnerApi('/api/secure/data?resource=partners&action=save-service', { method: 'POST', body: JSON.stringify({ id: s.id, name: s.name_ar, base_price: Number(base[s.id]), is_active: s.is_active }) }),
    onSuccess: () => { toast.success('تم حفظ السعر الأساسي'); onDone(); }, onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">السعر قبل الضريبة. السعر الخاص بالشركة يلغي السعر الأساسي؛ اتركه فاضياً لاستخدام الأساسي. التعديل للمدير فقط.</p>
      <div className="rounded-2xl border bg-white divide-y">
        <div className="grid grid-cols-[1fr_90px_90px] gap-2 p-2 text-xs font-bold text-gray-500"><span>الخدمة</span><span>أساسي</span><span>خاص بالشركة</span></div>
        {services.map((s) => (
          <div key={s.id} className="grid grid-cols-[1fr_90px_90px] gap-2 p-2 items-center text-sm">
            <span>{s.name_ar}</span>
            <span className="flex gap-1">
              <input type="number" min={0} step="0.01" disabled={!canEdit} value={base[s.id]} onChange={(e) => setBase({ ...base, [s.id]: e.target.value })} onBlur={() => canEdit && Number(base[s.id]) !== Number(s.base_price) && saveBase.mutate(s)} className="w-full border rounded px-1 py-1 disabled:bg-gray-50" />
            </span>
            <input type="number" min={0} step="0.01" disabled={!canEdit} value={custom[s.id]} placeholder="—" onChange={(e) => setCustom({ ...custom, [s.id]: e.target.value })} className="w-full border rounded px-1 py-1 disabled:bg-gray-50" />
          </div>
        ))}
      </div>
      {canEdit && <button disabled={saveCustom.isPending} onClick={() => saveCustom.mutate()} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: '#7c4a1e' }}>حفظ أسعار الشركة</button>}
      <p className="text-xs text-amber-700">⚠ السعر الأساسي لا يُحفظ إلا عند الخروج من الحقل، وأي خدمة سعرها صفر ترفض النظام تسجيل شنطة بها.</p>
    </div>
  );
}

function Info({ partner, canEdit, partnerId, onDone }) {
  const [f, setF] = useState({ name: partner.name || '', vat_number: partner.vat_number || '', cr_number: partner.cr_number || '', phone: partner.phone || '', address: partner.address || '', payment_terms_days: partner.payment_terms_days, turnaround_days: partner.turnaround_days });
  const m = useMutation({
    mutationFn: () => api(partnerId, 'update', 'POST', f),
    onSuccess: () => { toast.success('تم الحفظ'); onDone(); }, onError: (e) => toast.error(e.message),
  });
  const fld = (k, label, extra = {}) => (
    <label className="text-xs text-gray-600 space-y-1 block">{label}
      <input disabled={!canEdit} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-gray-50" {...extra} />
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {fld('name', 'اسم الشركة')}
        {fld('vat_number', 'الرقم الضريبي', { dir: 'ltr', maxLength: 15 })}
        {fld('cr_number', 'السجل التجاري', { dir: 'ltr' })}
        {fld('phone', 'الجوال', { dir: 'ltr' })}
        {fld('payment_terms_days', 'أيام السداد بعد الاستلام', { type: 'number', min: 0, max: 365 })}
        {fld('turnaround_days', 'أيام التسليم', { type: 'number', min: 0, max: 90 })}
      </div>
      {fld('address', 'العنوان')}
      {canEdit && <button disabled={m.isPending} onClick={() => m.mutate()} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: '#7c4a1e' }}>حفظ</button>}
    </div>
  );
}

function InvoiceModal({ inv, onClose }) {
  const items = Array.isArray(inv.items) ? inv.items : [];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 overflow-auto p-3 print:bg-white print:p-0" onClick={onClose}>
      <style>{`@media print{body *{visibility:hidden}#partner-invoice,#partner-invoice *{visibility:visible}#partner-invoice{position:absolute;inset:0}}`}</style>
      <div id="partner-invoice" dir="rtl" onClick={(e) => e.stopPropagation()} className="bg-white max-w-xl mx-auto rounded-2xl p-5 space-y-3 text-sm">
        <div className="text-center">
          <div className="font-black text-lg">فاتورة ضريبية</div>
          <div className="text-xs text-gray-500" dir="ltr">{inv.invoice_number} · {day(inv.created_at)}</div>
        </div>
        <div className="rounded-xl bg-gray-50 p-2 text-xs space-y-0.5">
          <div>العميل: <b>{inv.buyer_company_name}</b></div>
          {inv.buyer_vat_number && <div>الرقم الضريبي: <span dir="ltr">{inv.buyer_vat_number}</span></div>}
          {inv.buyer_cr_number && <div>السجل التجاري: <span dir="ltr">{inv.buyer_cr_number}</span></div>}
          {inv.buyer_address && <div>العنوان: {inv.buyer_address}</div>}
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b text-gray-500"><th className="text-right py-1">البند</th><th>الكمية</th><th>السعر</th></tr></thead>
          <tbody>{items.map((it, k) => (
            <tr key={k} className="border-b"><td className="py-1">{it.item_name}</td><td className="text-center">{it.qty}</td><td className="text-center">{money(it.sell_price)}</td></tr>
          ))}</tbody>
        </table>
        <div className="space-y-0.5 text-sm">
          <div className="flex justify-between"><span>المجموع قبل الضريبة</span><b>{money(inv.subtotal)}</b></div>
          <div className="flex justify-between"><span>ضريبة القيمة المضافة 15%</span><b>{money(inv.vat_amount)}</b></div>
          <div className="flex justify-between text-base font-black border-t pt-1"><span>الإجمالي</span><span>{money(inv.total)} ر.س</span></div>
        </div>
        <div className="flex justify-center">
          {inv.zatca_qr ? <QRCodeCanvas value={inv.zatca_qr} size={150} level="M" /> : <p className="text-xs text-amber-700">لم يصدر رمز زاتكا بعد (الإبلاغ قيد المعالجة).</p>}
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl text-white font-bold flex items-center justify-center gap-1" style={{ background: '#7c4a1e' }}><Printer className="w-4 h-4" />طباعة</button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border font-bold">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

function StatementModal({ data, onClose }) {
  const p = data.partner;
  const today = data.today;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState('all'); // all | paid | unpaid
  const invNo = Object.fromEntries((data.invoices || []).map((i) => [i.id, i.invoice_number]));
  const rows = (data.orders || [])
    .filter((o) => o.status !== 'cancelled' && Number(o.total_price) > 0)
    .filter((o) => (!from || day(o.created_at) >= from) && (!to || day(o.created_at) <= to))
    .filter((o) => mode === 'all' || (mode === 'paid') === (o.payment_status === 'paid'))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const sum = (f) => rows.filter(f).reduce((t, o) => t + Number(o.total_price || 0), 0);
  const paid = sum((o) => o.payment_status === 'paid');
  const unpaid = sum((o) => o.payment_status !== 'paid');
  const overdue = sum((o) => o.payment_status !== 'paid' && o.status === 'completed' && o.payment_due_date && day(o.payment_due_date) <= today);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 overflow-auto p-3 print:bg-white print:p-0" onClick={onClose}>
      <style>{`@media print{body *{visibility:hidden}#partner-statement,#partner-statement *{visibility:visible}#partner-statement{position:absolute;inset:0}}`}</style>
      <div id="partner-statement" dir="rtl" onClick={(e) => e.stopPropagation()} className="bg-white max-w-3xl mx-auto rounded-2xl p-5 space-y-3 text-sm">
        <div className="text-center">
          <div className="font-black text-lg">كشف حساب — {p.name}</div>
          <div className="text-xs text-gray-500">بتاريخ {today}{p.vat_number ? ` · الرقم الضريبي ${p.vat_number}` : ''}</div>
        </div>
        <div className="flex flex-wrap gap-2 items-center print:hidden text-xs">
          <label>من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-1 py-1" /></label>
          <label>إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-1 py-1" /></label>
          {[['all', 'الكل'], ['paid', 'المسدد'], ['unpaid', 'غير المسدد']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`px-3 py-1 rounded-full border font-bold ${mode === k ? 'bg-amber-800 text-white' : ''}`}>{l}</button>
          ))}
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b text-gray-500 text-right">
            <th className="py-1">التاريخ</th><th>الطلب</th><th>البيان</th><th>الاستحقاق</th><th>الحالة</th><th>الفاتورة</th><th>المبلغ</th>
          </tr></thead>
          <tbody>{rows.map((o) => {
            const ok = o.payment_status === 'paid';
            return (
              <tr key={o.id} className="border-b align-top">
                <td className="py-1">{day(o.created_at)}</td>
                <td dir="ltr">{o.order_number}</td>
                <td>{o.partner_ref ? `${o.partner_ref} — ` : ''}{o.description}</td>
                <td>{ok ? '—' : day(o.payment_due_date)}</td>
                <td className={ok ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>{ok ? 'مسدد' : 'غير مسدد'}</td>
                <td dir="ltr">{invNo[o.partner_invoice_id] || '—'}</td>
                <td className="font-bold">{money(o.total_price)}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {rows.length === 0 && <p className="text-center text-gray-500 py-4">لا توجد حركات</p>}
        <div className="border-t pt-2 space-y-0.5">
          <div className="flex justify-between"><span>إجمالي المسدد</span><b className="text-green-700">{money(paid)} ر.س</b></div>
          <div className="flex justify-between"><span>إجمالي غير المسدد</span><b className="text-red-700">{money(unpaid)} ر.س</b></div>
          <div className="flex justify-between"><span>منه مستحق السداد الآن</span><b>{money(overdue)} ر.س</b></div>
          <div className="flex justify-between font-black text-base border-t pt-1"><span>إجمالي الحركات</span><span>{money(paid + unpaid)} ر.س</span></div>
          <p className="text-[11px] text-gray-500">المبالغ شاملة ضريبة القيمة المضافة 15%.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl text-white font-bold flex items-center justify-center gap-1" style={{ background: '#7c4a1e' }}><Printer className="w-4 h-4" />طباعة / حفظ PDF</button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border font-bold">إغلاق</button>
        </div>
      </div>
    </div>
  );
}
