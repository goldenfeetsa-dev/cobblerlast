/** PartnersAdmin — إنشاء/إيقاف الشركات الشريكة (للإدارة فقط) */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Copy, Plus, Power } from 'lucide-react';

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `فشل الطلب (${res.status})`);
  return body;
}

export default function PartnersAdmin() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [newCode, setNewCode] = useState(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners-admin'],
    queryFn: () => api('/api/secure/data?resource=partners'),
  });
  const create = useMutation({
    mutationFn: () => api('/api/secure/data?resource=partners', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: (r) => { setNewCode({ name, code: r.code }); setName(''); qc.invalidateQueries({ queryKey: ['partners-admin'] }); },
    onError: (e) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => api(`/api/secure/data?resource=partners&id=${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners-admin'] }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div dir="rtl" className="max-w-3xl mx-auto p-4 space-y-5">
      <div>
        <h1 className="text-xl font-black">الشركاء</h1>
        <p className="text-sm text-gray-500">كل شركة تدخل من <span dir="ltr" className="font-mono">/partner</span> برمزها الخاص</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الشركة (مثال: صناع الحقائب)"
          className="flex-1 rounded-xl border px-3 py-2.5 text-sm" maxLength={80} />
        <button disabled={create.isPending} className="px-4 rounded-xl text-white font-bold flex items-center gap-1 disabled:opacity-60" style={{ background: '#7c4a1e' }}>
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إنشاء
        </button>
      </form>

      {newCode && (
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-bold">رمز {newCode.name} — يظهر مرة واحدة فقط، انسخه الآن وسلّمه للشركة:</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 text-center text-xl font-black tracking-widest bg-white rounded-xl py-2">{newCode.code}</code>
            <button onClick={() => { navigator.clipboard?.writeText(newCode.code); toast.success('تم النسخ'); }} className="p-3 rounded-xl bg-white border"><Copy className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setNewCode(null)} className="text-xs underline text-gray-600">تم النسخ، إخفاء</button>
        </div>
      )}

      {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
        <div className="space-y-2">
          {partners.length === 0 && <p className="text-center text-sm text-gray-500 py-6">لا توجد شركات بعد</p>}
          {partners.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-gray-500">طلبات حالية: {p.open} · الإجمالي: {p.total}</div>
              </div>
              <button onClick={() => toggle.mutate({ id: p.id, is_active: !p.is_active })}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full"
                style={p.is_active ? { background: '#d1fae5', color: '#047857' } : { background: '#fee2e2', color: '#b91c1c' }}>
                <Power className="w-3.5 h-3.5" />{p.is_active ? 'مفعّل — إيقاف' : 'موقوف — تفعيل'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
