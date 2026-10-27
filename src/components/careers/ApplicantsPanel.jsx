/** ApplicantsPanel — المتقدمون لوظيفة، مرتبون بدرجة مطابقة ATS (للإدارة فقط). */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, FileText, Phone, Trash2 } from 'lucide-react';

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `فشل الطلب (${res.status})`);
  return body;
}
const STATUS = { new: 'جديد', shortlisted: 'مرشّح', interview: 'مقابلة', rejected: 'مرفوض', hired: 'تم التوظيف' };
const scoreColor = (s) => (s >= 70 ? '#047857' : s >= 40 ? '#b45309' : '#b91c1c');

export default function ApplicantsPanel({ job, onClose }) {
  const qc = useQueryClient();
  const key = ['applicants', job.id];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => api(`/api/secure/data?resource=applications&job_id=${job.id}`) });
  const setStatus = useMutation({
    mutationFn: ({ id, status }) => api(`/api/secure/data?resource=applications&id=${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }), onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id) => api(`/api/secure/data?resource=applications&id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }), onError: (e) => toast.error(e.message),
  });
  const openCv = async (id) => {
    try { const { url } = await api(`/api/secure/data?resource=applications&op=cv&id=${id}`); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e.message === 'no_cv' ? 'لا توجد سيرة مرفقة' : e.message); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>المتقدمون — {job.title} ({data.length})</DialogTitle></DialogHeader>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-8" /> : data.length === 0 ? (
          <p className="text-center text-sm text-stone-400 py-8">لا يوجد متقدمون بعد</p>
        ) : (
          <div className="space-y-3">
            {data.map((a) => (
              <div key={a.id} className="rounded-xl border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{a.full_name}</p>
                    <p className="text-xs text-stone-500">{[a.city, a.years_experience != null && `${a.years_experience} سنة خبرة`, a.email].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="text-xl font-black" style={{ color: scoreColor(a.ats_score) }}>{a.ats_score}%</div>
                    <div className="text-[10px] text-stone-400">مطابقة ATS</div>
                  </div>
                </div>
                {a.about && <p className="text-xs text-stone-600 bg-stone-50 rounded p-2 whitespace-pre-line">{a.about}</p>}
                {a.ats_matched?.length > 0 && <p className="text-xs"><span className="text-emerald-700 font-bold">تحقق: </span>{a.ats_matched.join('، ')}</p>}
                {a.ats_missing?.length > 0 && <p className="text-xs"><span className="text-red-700 font-bold">ناقص: </span>{a.ats_missing.join('، ')}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 text-xs underline"><Phone className="w-3.5 h-3.5" />{a.phone}</a>
                  {a.cv_path && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openCv(a.id)}><FileText className="w-3.5 h-3.5 ml-1" />السيرة</Button>}
                  <select value={a.status} onChange={(e) => setStatus.mutate({ id: a.id, status: e.target.value })} className="h-7 text-xs border rounded px-1">
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={() => window.confirm('حذف الطلب والسيرة نهائياً؟') && del.mutate(a.id)} className="text-red-500 mr-auto" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
