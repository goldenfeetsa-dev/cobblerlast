import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Tag, Upload } from 'lucide-react';

const EMPTY = { name: '', name_ar: '', logo_url: '', sort_order: 0, is_active: true };

export default function BrandsAdmin() {
  const session = getSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands-admin'],
    queryFn: () => base44.entities.Brand.list('sort_order'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Brand.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['brands-admin'] }); setOpen(false); setForm(EMPTY); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Brand.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['brands-admin'] }); setOpen(false); setEditing(null); setForm(EMPTY); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Brand.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brands-admin'] }),
  });

  if (session?.role !== 'admin') return <Navigate to="/" replace />;

  const handleOpen = (brand = null) => {
    if (brand) { setEditing(brand); setForm({ name: brand.name, name_ar: brand.name_ar, logo_url: brand.logo_url || '', sort_order: brand.sort_order || 0, is_active: brand.is_active !== false }); }
    else { setEditing(null); setForm(EMPTY); }
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, logo_url: file_url }));
    setUploading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Tag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إدارة الماركات</h1>
            <p className="text-sm text-muted-foreground">الماركات المعروضة في الموقع</p>
          </div>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 ml-2" />
          إضافة ماركة
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>لا توجد ماركات بعد</p>
          <Button className="mt-4" onClick={() => handleOpen()}>أضف أول ماركة</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {brands.map(brand => (
            <Card key={brand.id} className={`relative overflow-hidden ${!brand.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="p-4 text-center">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="h-12 object-contain mx-auto mb-2" />
                ) : (
                  <div className="h-12 flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl font-black text-primary">{brand.name[0]}</span>
                  </div>
                )}
                <p className="font-bold text-sm">{brand.name}</p>
                <p className="text-xs text-muted-foreground">{brand.name_ar}</p>
                <div className="flex gap-1.5 mt-3 justify-center">
                  <button onClick={() => handleOpen(brand)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(brand.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل الماركة' : 'إضافة ماركة'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">الاسم بالإنجليزية</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Gucci" required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">الاسم بالعربي</label>
                <Input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} placeholder="غوتشي" required />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">شعار الماركة</label>
              {form.logo_url && (
                <img src={form.logo_url} alt="logo preview" className="h-16 object-contain mb-2 rounded border p-1 bg-white" />
              )}
              <div className="flex gap-2">
                <Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="رابط الشعار (اختياري)" />
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <Button type="button" variant="outline" disabled={uploading}>
                    {uploading ? <div className="w-4 h-4 border-2 border-t-primary rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">ترتيب العرض</label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-primary" />
                  <span className="text-sm font-medium">مفعّل</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'حفظ التعديلات' : 'إضافة'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}