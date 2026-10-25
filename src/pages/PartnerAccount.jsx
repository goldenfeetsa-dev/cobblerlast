/** PartnerAccount — حساب شركة واحدة: طلبات، استلام شنط، أسعار، فواتير ضريبية */
import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Plus, Trash2, Receipt, Barcode, Wallet, FileText } from 'lucide-react';
import { getSession } from '@/lib/sessionStore';
import { isFullAdmin } from '@/lib/roles';
import { partnerApi } from './PartnersAdmin';
import { PartnerInvoiceDoc, PartnerStatementDoc } from '@/components/partners/PartnerDocs';

import { Sar } from '@/components/shared/SarCurrency';
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
  const unpaidPriced = (o) => !isPaid(o) && o.status !== 'cancelled' && !o.partner_invoice_id && Number(o.total_price) > 0 && o.payment_due_date;
  const dueKey = (o) => String(o.payment_due_date).slice(0, 10);
  const isDue = (o) => unpaidPriced(o) && dueKey(o) <= today;
  const soonLimit = new Date(new Date(today).getTime() + 2 * 86400000).toISOString().slice(0, 10);
  const isSoon = (o) => unpaidPriced(o) && dueKey(o) > today && dueKey(o) <= soonLimit;
  const dueOrders = orders.filter(isDue);
  const soonOrders = orders.filter(isSoon);
  const soonTotal = soonOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const dueNotDelivered = dueOrders.filter((o) => !isDelivered(o)).length;
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
            رقم ضريبي: <span dir="ltr">{p.vat_number || 'غير مُدخل'}</span> · التسليم {p.turnaround_days} أيام · السداد بعد استلام الطلب بـ {p.payment_terms_days} يوم
          </p>
        </div>
        <button onClick={() => setShowStatement(true)} className="px-3 py-2 rounded-xl border bg-white text-sm font-bold flex items-center gap-1 shrink-0"><FileText className="w-4 h-4" />كشف حساب</button>
      </div>

      {/* زر مستحق السداد الآن */}
      <button
        onClick={() => { setTab('orders'); setFilter('unpaid'); setSel(new Set(dueOrders.filter(isInvoiceable).map((o) => o.id))); }}
        className="w-full rounded-2xl border-2 border-red-300 bg-red-50 p-3 text-right flex items-center justify-between">
        <span className="flex items-center gap-2 text-red-700 font-bold text-sm"><Wallet className="w-5 h-5" />مستحق السداد الآن ({dueOrders.length} شنطة مرّ عليها {p.payment_terms_days} يوم من استلام الطلب)</span>
        <span className="text-lg font-black text-red-700"><Sar>{money(dueTotal)}</Sar></span>
      </button>

      {soonOrders.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          ⏰ تنبيه: {soonOrders.length} شنطة يحل موعد سدادها خلال يومين — إجمالي <Sar>{money(soonTotal)}</Sar>
        </div>
      )}
      {dueNotDelivered > 0 && (
        <div className="rounded-xl bg-red-50 text-red-700 text-xs p-2">
          منها {dueNotDelivered} شنطة حلّ موعد سدادها ولم تُسلَّم بعد — لا تُفوتَر إلا بعد التسليم (تأكد من إنجازها).
        </div>
      )}

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
                <b>{selected.length}</b> محدد — الإجمالي شامل الضريبة: <b className="text-base"><Sar>{money(selTotal)}</Sar></b>
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
                    {!due && isSoon(o) && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">يستحق قريباً</span>}
                  </div>
                  <div className="text-xs text-gray-600 truncate">{o.description}</div>
                  <div className="text-[11px] text-gray-500">
                    استلام الطلب: {day(o.created_at)} · موعد التسليم للشركة: <b>{day(o.delivery_date)}</b>
                    {o.delivered_at && <> · سُلّمت: {day(o.delivered_at)}</>}
                    {o.payment_due_date && !isPaid(o) && <> · موعد السداد: <b>{day(o.payment_due_date)}</b></>}
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
              <div className="font-black"><Sar>{money(i.total)}</Sar></div>
            </button>
          ))}
        </div>
      )}
      {tab === 'info' && <Info partner={p} canEdit={canEdit} partnerId={id} onDone={refresh} />}

      {showStatement && <PartnerStatementDoc data={data} onClose={() => setShowStatement(false)} />}
      {invoiceView && <PartnerInvoiceDoc inv={invoiceView} onClose={() => setInvoiceView(null)} />}
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
          <div className="text-xs text-gray-500">شامل الضريبة (تقديري): <Sar><b>{money(bagTotal(b))}</b></Sar></div>
        </div>
      ))}
      <div className="flex gap-2 items-center">
        <button onClick={() => setBags([...bags, blank()])} className="px-3 py-2 rounded-xl border text-sm font-bold flex items-center gap-1"><Plus className="w-4 h-4" />شنطة أخرى</button>
        <div className="flex-1 text-sm text-left">الإجمالي: <Sar><b>{money(grand)}</b></Sar></div>
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
        {fld('payment_terms_days', 'أيام السداد بعد استلام الطلب', { type: 'number', min: 0, max: 365 })}
        {fld('turnaround_days', 'أيام التسليم', { type: 'number', min: 0, max: 90 })}
      </div>
      {fld('address', 'العنوان')}
      {canEdit && <button disabled={m.isPending} onClick={() => m.mutate()} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: '#7c4a1e' }}>حفظ</button>}
    </div>
  );
}
