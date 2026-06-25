import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Phone, Plus, Pencil, Trash2, GitBranch, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = { name: '', address: '', phone: '', whatsapp: '', maps_url: '', maps_embed: '', working_hours: '', is_active: true, sort_order: 0 };

export default function BranchesAdmin() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list('sort_order'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editId
      ? base44.entities.Branch.update(editId, data)
      : base44.entities.Branch.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success(editId ? 'تم تحديث الفرع' : 'تم إضافة الفرع');
      setOpen(false);
      setForm(EMPTY);
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Branch.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success('تم حذف الفرع');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, val }) => base44.entities.Branch.update(id, { is_active: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
  });

  const openAdd = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (b) => { setForm({ ...b }); setEditId(b.id); setOpen(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إدارة الفروع</h1>
            <p className="text-sm text-muted-foreground">{branches.length} فرع</p>
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة فرع
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-20">
          <GitBranch className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">لا توجد فروع بعد</p>
          <Button onClick={openAdd} className="mt-4">إضافة أول فرع</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map(b => (
            <Card key={b.id} className={`${!b.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{b.name}</CardTitle>
                    <Badge variant={b.is_active ? 'default' : 'secondary'} className="mt-1 text-xs">
                      {b.is_active ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={b.is_active}
                      onCheckedChange={val => toggleActive.mutate({ id: b.id, val })}
                    />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(b.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{b.address}</span>
                </div>
                {b.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span dir="ltr">{b.phone}</span>
                  </div>
                )}
                {b.working_hours && (
                  <p className="text-muted-foreground text-xs">{b.working_hours}</p>
                )}
                {b.maps_url && (
                  <a href={b.maps_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" />
                    عرض على الخريطة
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل الفرع' : 'إضافة فرع جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>اسم الفرع *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: فرع العزيزية" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>العنوان *</Label>
                <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="حي العزيزية، شارع الشباب..." className="mt-1" />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="05XXXXXXXX" className="mt-1" dir="ltr" />
              </div>
              <div>
                <Label>رقم واتساب</Label>
                <Input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="+96654..." className="mt-1" dir="ltr" />
              </div>
              <div className="col-span-2">
                <Label>ساعات العمل</Label>
                <Input value={form.working_hours} onChange={e => setForm(p => ({ ...p, working_hours: e.target.value }))} placeholder="السبت-الخميس 11:30ص-11:30م" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>رابط خرائط Google</Label>
                <Input value={form.maps_url} onChange={e => setForm(p => ({ ...p, maps_url: e.target.value }))} placeholder="https://maps.google.com/..." className="mt-1" dir="ltr" />
              </div>
              <div className="col-span-2">
                <Label>رابط iframe للخريطة (للعرض في الموقع)</Label>
                <Textarea value={form.maps_embed} onChange={e => setForm(p => ({ ...p, maps_embed: e.target.value }))} placeholder="https://www.google.com/maps/embed?pb=..." className="mt-1 h-20 text-xs" dir="ltr" />
                <p className="text-xs text-muted-foreground mt-1">من Google Maps: اضغط Share ← Embed a map ← انسخ رابط src فقط</p>
              </div>
              <div>
                <Label>ترتيب العرض</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} className="mt-1 w-24" />
              </div>
              <div className="flex items-center gap-2 mt-5">
                <Switch checked={form.is_active} onCheckedChange={val => setForm(p => ({ ...p, is_active: val }))} />
                <Label>فرع نشط</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.address || saveMutation.isPending}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}