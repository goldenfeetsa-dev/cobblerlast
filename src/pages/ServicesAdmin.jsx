import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, Scissors, ShoppingBag, Tag, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const EMPTY = { name: '', name_ar: '', category: 'shoes', description: '', price: '', duration_minutes: 30, is_active: true };

export default function ServicesAdmin() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: services = [] } = useQuery({
    queryKey: ['all-services'],
    queryFn: () => base44.entities.Service.list(),
  });

  const save = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Service.update(editing.id, data)
      : base44.entities.Service.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-services'] });
      qc.invalidateQueries({ queryKey: ['public-services'] });
      setOpen(false);
      toast({ title: editing ? 'تم تحديث الخدمة' : 'تمت إضافة الخدمة' });
    },
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-services'] }); toast({ title: 'تم الحذف' }); },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s, price: String(s.price), duration_minutes: String(s.duration_minutes) }); setOpen(true); };

  const handleSave = () => {
    if (!form.name_ar || !form.price) return;
    save.mutate({ ...form, price: Number(form.price), duration_minutes: Number(form.duration_minutes) });
  };

  const shoes = services.filter(s => s.category === 'shoes');
  const bags = services.filter(s => s.category === 'bags');

  const renderGroup = (label, icon, items) => {
    const Icon = icon;
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-5 h-5 text-stone-600" />
          <h3 className="font-bold text-stone-700">{label}</h3>
          <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-2 py-0.5">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <div className="bg-stone-50 rounded-xl border border-dashed border-stone-200 p-6 text-center text-stone-400 text-sm">
            لا توجد خدمات — أضف أولى خدماتك
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map(s => (
              <div key={s.id} className={cn("bg-white rounded-xl border p-4 transition-all", s.is_active ? "border-stone-200" : "border-stone-100 opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-stone-800 truncate">{s.name_ar}</p>
                      {!s.is_active && <span className="text-xs bg-stone-100 text-stone-400 rounded px-1.5 py-0.5">مخفي</span>}
                    </div>
                    <p className="text-xs text-stone-500 mb-2">{s.description}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-600 font-bold text-sm flex items-center gap-1"><Tag className="w-3.5 h-3.5" />{s.price} ر.س</span>
                      <span className="text-stone-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{s.duration_minutes} د</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} className="h-8 w-8">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader><AlertDialogTitle>تأكيد الحذف</AlertDialogTitle></AlertDialogHeader>
                        <p className="text-sm text-stone-500">هل تريد حذف "{s.name_ar}"؟</p>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(s.id)} className="bg-red-500">حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-stone-800">إدارة الخدمات</h1>
          <p className="text-stone-500 text-sm mt-1">أضف وعدّل خدمات إصلاح الأحذية والشنط</p>
        </div>
        <Button onClick={openNew} className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold">
          <Plus className="w-4 h-4 ml-2" />
          إضافة خدمة
        </Button>
      </div>

      {renderGroup('إصلاح الأحذية', Scissors, shoes)}
      {renderGroup('إصلاح الشنط', ShoppingBag, bags)}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">اسم الخدمة بالعربية *</label>
              <Input value={form.name_ar} onChange={e => setForm(p => ({ ...p, name_ar: e.target.value, name: e.target.value }))} placeholder="مثال: تغيير نعل الحذاء" dir="rtl" className="text-right" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">الفئة</label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shoes">أحذية</SelectItem>
                  <SelectItem value="bags">شنط</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">الوصف</label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف مختصر للخدمة" dir="rtl" className="text-right" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">السعر (ر.س) *</label>
                <Input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} type="number" min="0" placeholder="50" />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">المدة (دقائق)</label>
                <Input value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} type="number" min="15" step="15" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                className={cn("relative w-12 h-6 rounded-full transition-colors", form.is_active ? "bg-amber-500" : "bg-stone-200")}
              >
                <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", form.is_active ? "right-0.5" : "left-0.5")} />
              </button>
              <span className="text-sm font-medium text-stone-700">{form.is_active ? 'ظاهرة للعملاء' : 'مخفية'}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={!form.name_ar || !form.price || save.isPending} className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold">
              {save.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}