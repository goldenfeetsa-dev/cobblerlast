/** PartnersAdmin — قائمة الشركات (حسابات B2B): إنشاء، إيقاف، ملخص المستحقات */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Copy, Plus, Power, ChevronLeft, AlertTriangle } from 'lucide-react';
import { getSession } from '@/lib/sessionStore';
import { isFullAdmin } from '@/lib/roles';

export async function partnerApi(path, opts = {}) {
  const res = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `فشل الطلب (${res.status})`);
  return body;
}
const money = (n) => `${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

export default function PartnersAdmin() {
  const qc = useQueryClient();
  const canEdit = isFullAdmin(getSession()?.role);
  const [form, setForm] = useState({ name: '', vat_number: '', cr_number: '', phone: '', address: '' });
  const [newCode, setNewCode] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: partners = [], isLoading, error } = useQuery({
    queryKey: ['partners-admin'],
    queryFn: () => partnerApi('/api/secure/data?resource=partners'),
  });
  const create = useMutation({
    mutationFn: () => partnerApi('/api/secure/data?resource=partners', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: (r) => {
      setNewCode({ name: form.name, code: r.code });
      setForm({ name: '', vat_number: '', cr_number: '', phone: '', address: '' });
      qc.invalidateQueries({ queryKey: ['partners-admin'] });
    },
    onError: (e) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => partnerApi(`/api/secure/data?resource=partners&id=${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners-admin'] }),
    onError: (e) => toast.error(e.message),
  });

  const totalDue = partners.reduce((s, p) => s + (Number(p.due_total) || 0), 0);
  const totalUnpaid = partners.reduce((s, p) => s + (Number(p.unpaid_total) || 0), 0);
  const inp = 'rounded-xl border px-3 py-2.5 text-sm w-full';

  return (
    <div dir="rtl" className="max-w-3xl mx-auto p-4 space-y-5">
      <div>
        <h1 className="text-xl font-black">الشركات (حسابات الجملة)</h1>
        <p className="text-sm text-gray-500">أسعار خاصة لكل شركة، فواتير ضريبية مجمّعة، وسداد بعد استلام الطلب</p>
      </div>

      {partners.some((p) => Number(p.soon_count) > 0) && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-800 space-y-1">
          <div>⏰ تنبيه: مبالغ يحل سدادها خلال يومين</div>
          {partners.filter((p) => Number(p.soon_count) > 0).map((p) => (
            <div key={p.id} className="text-xs font-normal">{p.name}: {p.soon_count} شنطة — {money(p.soon_total)}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-3">
          <div className="text-xs text-red-700 font-bold">مستحق السداد الآن (مرّ على استلام الطلب المدة المتفق عليها)</div>
          <div className="text-lg font-black text-red-700">{money(totalDue)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-3">
          <div className="text-xs text-gray-500 font-bold">إجمالي غير المسدّد</div>
          <div className="text-lg font-black">{money(totalUnpaid)}</div>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) create.mutate(); }} className="rounded-2xl border bg-white p-3 space-y-2">
          <div className="font-bold text-sm">إضافة شركة</div>
          <input value={form.name} onChange={set('name')} placeholder="اسم الشركة *" className={inp} maxLength={80} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.vat_number} onChange={set('vat_number')} placeholder="الرقم الضريبي (15 رقماً)" className={inp} dir="ltr" inputMode="numeric" maxLength={15} />
            <input value={form.cr_number} onChange={set('cr_number')} placeholder="السجل التجاري" className={inp} dir="ltr" />
            <input value={form.phone} onChange={set('phone')} placeholder="الجوال" className={inp} dir="ltr" />
            <input value={form.address} onChange={set('address')} placeholder="العنوان" className={inp} />
          </div>
          <button disabled={create.isPending} className="w-full py-2.5 rounded-xl text-white font-bold flex items-center justify-center gap-1 disabled:opacity-60" style={{ background: '#7c4a1e' }}>
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إنشاء الشركة
          </button>
          <p className="text-xs text-gray-500">الرقم الضريبي مطلوب قبل إصدار أول فاتورة ضريبية، ويمكن إضافته لاحقاً من صفحة الشركة.</p>
        </form>
      )}

      {newCode && (
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-bold">رمز دخول {newCode.name} لبوابة الشركة — يظهر مرة واحدة فقط:</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 text-center text-xl font-black tracking-widest bg-white rounded-xl py-2">{newCode.code}</code>
            <button onClick={() => { navigator.clipboard?.writeText(newCode.code); toast.success('تم النسخ'); }} className="p-3 rounded-xl bg-white border"><Copy className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setNewCode(null)} className="text-xs underline text-gray-600">تم النسخ، إخفاء</button>
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm p-3 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error.message}</div>}
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
        <div className="space-y-2">
          {partners.length === 0 && !error && <p className="text-center text-sm text-gray-500 py-6">لا توجد شركات بعد</p>}
          {partners.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-white px-4 py-3 flex items-center gap-3">
              <Link to={`/admin/partners/${p.id}`} className="flex-1 min-w-0">
                <div className="font-bold flex items-center gap-1">{p.name}<ChevronLeft className="w-4 h-4 text-gray-400" /></div>
                <div className="text-xs text-gray-500">قيد العمل: {p.open} · الإجمالي: {p.total} · غير مسدّد: {money(p.unpaid_total)}</div>
                {Number(p.due_total) > 0 && <div className="text-xs font-bold text-red-600">مستحق الآن: {money(p.due_total)} ({p.due_count} شنطة)</div>}
              </Link>
              {canEdit && (
                <button onClick={() => toggle.mutate({ id: p.id, is_active: !p.is_active })}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
                  style={p.is_active ? { background: '#d1fae5', color: '#047857' } : { background: '#fee2e2', color: '#b91c1c' }}>
                  <Power className="w-3.5 h-3.5" />{p.is_active ? 'مفعّل' : 'موقوف'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
