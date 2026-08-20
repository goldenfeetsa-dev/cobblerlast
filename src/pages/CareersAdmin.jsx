import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { Plus, Pencil, Trash2, Briefcase, MapPin, Wallet, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const EMPTY = {
  title: '', department: '', employment_type: 'full_time', location: '',
  description: '', requirements: '', salary_note: '',
  apply_method: 'whatsapp', apply_value: '', is_active: true,
};

const EMPLOYMENT_LABELS = { full_time: 'دوام كامل', part_time: 'دوام جزئي', contract: 'عقد مؤقت' };
const APPLY_LABELS = { whatsapp: 'واتساب', email: 'إيميل', phone: 'اتصال', link: 'رابط خارجي' };

function slugify(title) {
  const base = title
    .trim()
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  return `${base || 'job'}-${Date.now().toString(36).slice(-5)}`;
}

export default function CareersAdmin() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: jobs = [] } = useQuery({
    queryKey: ['all-job-postings'],
    queryFn: () => db.JobPosting.list('-created_at', 200),
  });

  const save = useMutation({
    mutationFn: (data) => editing
      ? db.JobPosting.update(editing.id, data)
      : db.JobPosting.create({ ...data, slug: slugify(data.title) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-job-postings'] });
      qc.invalidateQueries({ queryKey: ['public-job-postings'] });
      setOpen(false);
      toast({ title: editing ? 'تم تحديث الوظيفة' : 'تم نشر الوظيفة' });
    },
    onError: (e) => toast({ title: 'صار خطأ', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: (id) => db.JobPosting.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-job-postings'] });
      qc.invalidateQueries({ queryKey: ['public-job-postings'] });
      toast({ title: 'تم الحذف' });
    },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (j) => { setEditing(j); setForm({ ...EMPTY, ...j }); setOpen(true); };

  const handleSave = () => {
    if (!form.title || !form.apply_value) return;
    save.mutate(form);
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-stone-800">إدارة الوظائف الشاغرة</h1>
          <p className="text-stone-500 text-sm mt-1">
            الوظائف المفعّلة تظهر تلقائياً بصفحة الوظائف العامة وتُفهرس بجوجل
          </p>
        </div>
        <Button onClick={openNew} className="bg-amber-500 dark:bg-amber-900/60 hover:bg-amber-400 text-stone-900 font-bold">
          <Plus className="w-4 h-4 ml-2" />
          نشر وظيفة
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-stone-50 rounded-xl border border-dashed border-stone-200 p-8 text-center text-stone-400 text-sm">
          ما فيه وظائف منشورة — اضغط "نشر وظيفة" لإضافة أول وظيفة
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {jobs.map(j => (
            <div key={j.id} className={cn("bg-white rounded-xl border p-4 transition-all", j.is_active ? "border-stone-200" : "border-stone-100 opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-bold text-stone-800">{j.title}</p>
                    {!j.is_active && <span className="text-xs bg-stone-100 text-stone-400 rounded px-1.5 py-0.5">غير منشورة</span>}
                    <span className="text-xs bg-amber-50 text-amber-700 dark:text-amber-300 rounded px-1.5 py-0.5">{EMPLOYMENT_LABELS[j.employment_type]}</span>
                  </div>
                  {j.department && <p className="text-xs text-stone-500 mb-1">{j.department}</p>}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-stone-500 mt-2">
                    {j.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{j.location}</span>}
                    {j.salary_note && <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" />{j.salary_note}</span>}
                    <span className="flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" />التقديم: {APPLY_LABELS[j.apply_method]}</span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(j)} className="h-8 w-8">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 dark:text-red-300 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader><AlertDialogTitle>تأكيد الحذف</AlertDialogTitle></AlertDialogHeader>
                      <p className="text-sm text-stone-500">هل تريد حذف وظيفة "{j.title}"؟</p>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(j.id)} className="bg-red-500 dark:bg-red-900/60">حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5" />{editing ? 'تعديل الوظيفة' : 'نشر وظيفة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">المسمى الوظيفي *</label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: فني إصلاح أحذية" dir="rtl" className="text-right" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">القسم</label>
                <Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} placeholder="مثال: الورشة" dir="rtl" className="text-right" />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">نوع الدوام</label>
                <Select value={form.employment_type} onValueChange={v => setForm(p => ({ ...p, employment_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">دوام كامل</SelectItem>
                    <SelectItem value="part_time">دوام جزئي</SelectItem>
                    <SelectItem value="contract">عقد مؤقت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">الموقع / الفرع</label>
              <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="مثال: الرياض - فرع العليا" dir="rtl" className="text-right" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">وصف الوظيفة</label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="نبذة عن المهام والمسؤوليات" dir="rtl" className="text-right min-h-[80px]" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">المتطلبات</label>
              <Textarea value={form.requirements} onChange={e => setForm(p => ({ ...p, requirements: e.target.value }))} placeholder="كل شرط بسطر مستقل" dir="rtl" className="text-right min-h-[80px]" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">الراتب (اختياري)</label>
              <Input value={form.salary_note} onChange={e => setForm(p => ({ ...p, salary_note: e.target.value }))} placeholder="مثال: 4000 - 5500 ر.س أو يُحدد بعد المقابلة" dir="rtl" className="text-right" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">طريقة التقديم</label>
                <Select value={form.apply_method} onValueChange={v => setForm(p => ({ ...p, apply_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">واتساب</SelectItem>
                    <SelectItem value="email">إيميل</SelectItem>
                    <SelectItem value="phone">اتصال</SelectItem>
                    <SelectItem value="link">رابط خارجي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">
                  {form.apply_method === 'whatsapp' && 'رقم الواتساب (966...)'}
                  {form.apply_method === 'email' && 'الإيميل'}
                  {form.apply_method === 'phone' && 'رقم الجوال'}
                  {form.apply_method === 'link' && 'الرابط'}
                </label>
                <Input value={form.apply_value} onChange={e => setForm(p => ({ ...p, apply_value: e.target.value }))} placeholder="..." dir="ltr" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                className={cn("relative w-12 h-6 rounded-full transition-colors", form.is_active ? "bg-amber-500 dark:bg-amber-900/60" : "bg-stone-200")}
              >
                <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", form.is_active ? "right-0.5" : "left-0.5")} />
              </button>
              <span className="text-sm font-medium text-stone-700">{form.is_active ? 'منشورة وظاهرة للزوار' : 'مسودة (مخفية)'}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.apply_value || save.isPending} className="bg-amber-500 dark:bg-amber-900/60 hover:bg-amber-400 text-stone-900 font-bold">
              {save.isPending ? 'جارٍ الحفظ...' : 'حفظ ونشر'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
