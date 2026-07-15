/**
 * Suppliers — قسم الموردين
 * ─────────────────────────────────────────────────────────────
 * كل مورد: بياناته الأساسية + قائمة منتجات مخزون (inventory_items)
 * نشتريها منه. أي منتج من منتجاته نفد بالكامل من كل الفروع
 * والورشة يتعلّم تلقائياً بالأحمر ⚠️ حتى يعرف صاحب المحل إنه
 * محتاج يطلب من هذا المورد بالذات.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseApi';
import { getSession } from '@/lib/sessionStore';
import { ROLES } from '@/lib/roles';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Truck, Plus, Pencil, Trash2, Phone, Mail, Package, AlertTriangle, Search, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { isValidVatFormat } from '@/lib/vatValidation';

const UNITS = { piece: 'حبة', dozen: 'درزن', carton: 'كرتون', kg: 'كغ', liter: 'لتر' };

function totalStock(item) {
  const branchTotal = Object.values(item?.branch_qty || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  return (Number(item?.workshop_qty) || 0) + branchTotal;
}

export default function Suppliers() {
  const session = getSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '', vat_number: '' });
  const [productPicker, setProductPicker] = useState(null); // supplier id لما نفتح مربع اختيار المنتجات
  const [productSearch, setProductSearch] = useState('');

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list('name', 200),
  });
  const { data: links = [] } = useQuery({
    queryKey: ['supplier-products'], queryFn: () => base44.entities.SupplierProduct.list('-created_at', 1000),
  });
  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'], queryFn: () => base44.entities.InventoryItem.list('-created_at', 500),
  });

  // بناءً على طلب صريح: الموردون تظهر للمالك فقط، مو لكل أدوار الإدارة/المحاسب
  if (session?.role !== ROLES.OWNER) return <Navigate to="/pos" replace />;

  const saveMutation = useMutation({
    mutationFn: (data) => editingSupplier
      ? base44.entities.Supplier.update(editingSupplier.id, data)
      : base44.entities.Supplier.create({ ...data, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(editingSupplier ? 'تم تحديث بيانات المورد' : 'تم إضافة المورد');
      setDialogOpen(false);
      setEditingSupplier(null);
      setForm({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '', vat_number: '' });
    },
    onError: (e) => toast.error(`فشل الحفظ: ${e.message || 'خطأ غير معروف'}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('تم حذف المورد');
    },
  });

  const toggleProductLink = useMutation({
    mutationFn: async ({ supplierId, itemId, linked }) => {
      if (linked) {
        const existing = links.find(l => l.supplier_id === supplierId && l.item_id === itemId);
        if (existing) await base44.entities.SupplierProduct.delete(existing.id);
      } else {
        await base44.entities.SupplierProduct.create({ supplier_id: supplierId, item_id: itemId });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplier-products'] }),
    onError: (e) => toast.error(`تعذّر التحديث: ${e.message || ''}`),
  });

  const openEdit = (s) => {
    setEditingSupplier(s);
    setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '', vat_number: s.vat_number || '' });
    setDialogOpen(true);
  };
  const openNew = () => {
    setEditingSupplier(null);
    setForm({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '', vat_number: '' });
    setDialogOpen(true);
  };

  const itemsById = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);

  const supplierProducts = (supplierId) =>
    links.filter(l => l.supplier_id === supplierId).map(l => itemsById[l.item_id]).filter(Boolean);

  const filteredItemsForPicker = items.filter(i =>
    !productSearch || i.name?.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black">الموردون</h1>
            <p className="text-sm text-muted-foreground">إدارة الموردين والمنتجات اللي تشتريها من كل واحد منهم</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 ml-1" /> إضافة مورد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{editingSupplier ? 'تعديل مورد' : 'مورد جديد'}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>اسم المورد *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: مؤسسة الجلود الذهبية" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>اسم المسؤول</Label>
                  <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>الجوال</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="05XXXXXXXX" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>العنوان</Label>
                <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>الرقم الضريبي (VAT)</Label>
                <Input
                  value={form.vat_number}
                  onChange={e => setForm(p => ({ ...p, vat_number: e.target.value.replace(/[^\d]/g, '') }))}
                  placeholder="3XXXXXXXXXXXXX3 — 15 رقم"
                  maxLength={15}
                  dir="ltr"
                  className="text-left"
                />
                {form.vat_number && (
                  isValidVatFormat(form.vat_number) ? (
                    <p className="text-[11px] text-green-600 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> صيغة الرقم صحيحة</p>
                  ) : (
                    <p className="text-[11px] text-red-600 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> يجب أن يكون 15 رقماً يبدأ وينتهي بـ 3</p>
                  )
                )}
                {!form.vat_number && (
                  <p className="text-[11px] text-amber-600 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> بدون رقم ضريبي، فواتير الشراء من هذا المورد لن تُقبل بالإقرار الضريبي</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="h-20" />
              </div>
              <Button className="w-full" disabled={!form.name || saveMutation.isPending}
                onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? '...' : 'حفظ'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-bold">ما فيه موردين مضافين بعد</p>
          <p className="text-sm mt-1">اضغط «إضافة مورد» عشان تبدأ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map(s => {
            const myProducts = supplierProducts(s.id);
            const outOfStock = myProducts.filter(i => totalStock(i) <= 0);
            return (
              <Card key={s.id} className={outOfStock.length > 0 ? 'border-red-300' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {s.name}
                        {outOfStock.length > 0 && (
                          <Badge className="bg-red-100 text-red-700 text-[10px] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {outOfStock.length} منتج نفد
                          </Badge>
                        )}
                        {isValidVatFormat(s.vat_number) ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px] flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> رقم ضريبي
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px] flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> بدون رقم ضريبي
                          </Badge>
                        )}
                      </CardTitle>
                      {s.contact_name && <p className="text-xs text-muted-foreground mt-1">{s.contact_name}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف المورد؟</AlertDialogTitle>
                            <AlertDialogDescription>سيتم حذف «{s.name}» وربطه بكل المنتجات المسجلة له.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(s.id)} className="bg-red-600 hover:bg-red-700">حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                    {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" /> منتجاته ({myProducts.length})
                      </p>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setProductPicker(s.id); setProductSearch(''); }}>
                        إدارة المنتجات
                      </Button>
                    </div>
                    {myProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">ما فيه منتجات مربوطة بهذا المورد بعد</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {myProducts.map(i => {
                          const out = totalStock(i) <= 0;
                          return (
                            <Badge key={i.id} variant="outline"
                              className={`text-[11px] ${out ? 'border-red-400 text-red-600 bg-red-50 font-bold' : ''}`}>
                              {out && <AlertTriangle className="w-3 h-3 ml-1" />}
                              {i.name} {out ? '— نفد من المخزن' : `(${totalStock(i)} ${UNITS[i.unit] || i.unit || ''})`}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Product picker dialog */}
      <Dialog open={!!productPicker} onOpenChange={(o) => !o && setProductPicker(null)}>
        <DialogContent dir="rtl" className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>منتجات {suppliers.find(s => s.id === productPicker)?.name}</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="ابحث عن منتج من المخزون..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pr-9" />
          </div>
          <div className="overflow-y-auto space-y-1 pr-1">
            {filteredItemsForPicker.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">ما فيه منتجات بالمخزون تطابق البحث</p>
            ) : filteredItemsForPicker.map(item => {
              const linked = links.some(l => l.supplier_id === productPicker && l.item_id === item.id);
              const out = totalStock(item) <= 0;
              return (
                <button key={item.id} type="button"
                  onClick={() => toggleProductLink.mutate({ supplierId: productPicker, itemId: item.id, linked })}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-right transition-all ${linked ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50'}`}>
                  <span className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${linked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                      {linked && <span className="w-2 h-2 rounded-sm bg-white" />}
                    </span>
                    {item.name}
                  </span>
                  <span className={`text-xs ${out ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                    {out ? 'نفد من المخزن ⚠️' : `${totalStock(item)} ${UNITS[item.unit] || item.unit || ''}`}
                  </span>
                </button>
              );
            })}
          </div>
          <Button variant="outline" onClick={() => setProductPicker(null)}><X className="w-4 h-4 ml-1" /> تم</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
