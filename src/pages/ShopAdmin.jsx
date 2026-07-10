import React, { useState } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Package, Star, ToggleLeft, ToggleRight } from 'lucide-react';
import ProductImageUploader from '@/components/shop/ProductImageUploader';

const CATEGORIES = {
  soles: 'نعال وأكواع',
  leather: 'جلود فاخرة',
  threads: 'خيوط وإبر',
  zippers: 'سحّابات',
  care: 'مواد العناية',
  tools: 'أدوات الورشة',
  adhesives: 'مواد اللصق',
  other: 'أخرى',
};

const EMPTY = { name: '', name_ar: '', description: '', category: 'soles', price: '', original_price: '', image_url: '', in_stock: true, is_featured: false, sort_order: 0 };

function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="rounded-2xl p-6 mb-6 border" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
      <h3 className="font-bold text-lg mb-5">{initial?.id ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">الاسم بالعربي *</label>
          <Input value={form.name_ar} onChange={e => set('name_ar', e.target.value)} placeholder="كريم تلميع فاخر" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">الاسم بالإنجليزي</label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Luxury Shoe Polish" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">الفئة *</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="w-full h-9 rounded-md border bg-transparent px-3 text-sm"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">السعر (ر.س) *</label>
          <Input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="85" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">السعر قبل الخصم</label>
          <Input type="number" value={form.original_price} onChange={e => set('original_price', e.target.value)} placeholder="120" />
        </div>
        <div className="sm:col-span-2">
          <ProductImageUploader value={form.image_url} onChange={(url) => set('image_url', url)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-muted-foreground mb-1 block">الوصف</label>
          <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="وصف مختصر للمنتج..." />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.in_stock} onChange={e => set('in_stock', e.target.checked)} />
            متوفر
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} />
            مميز
          </label>
        </div>
      </div>
      {!form.image_url && (
        <p className="text-xs text-amber-600 mb-3">⚠️ بدون صورة حقيقية، لن يظهر المنتج في نتائج بحث الصور بجوجل، وسيُستبدل بصورة عامة مؤقتة في المتجر.</p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => onSave(form)} className="bg-primary" disabled={!form.name_ar || !form.price}>حفظ</Button>
        <Button variant="outline" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );
}

export default function ShopAdmin() {
  const session = getSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-admin'],
    queryFn: () => base44.entities.Product.list('sort_order'),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Product.create({ ...d, price: Number(d.price), original_price: d.original_price ? Number(d.original_price) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products-admin'] }); setAdding(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => base44.entities.Product.update(id, { ...d, price: Number(d.price), original_price: d.original_price ? Number(d.original_price) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products-admin'] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products-admin'] }),
  });

  const toggleStock = (p) => updateMut.mutate({ id: p.id, in_stock: !p.in_stock });

  if (!['admin','owner','manager'].includes(session?.role)) return <div className="p-8 text-center text-muted-foreground">غير مصرح لك بالوصول</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">إدارة المتجر</h1>
          <p className="text-muted-foreground text-sm">{products.length} منتج</p>
        </div>
        <Button onClick={() => { setAdding(true); setEditing(null); }} className="gap-2">
          <Plus className="w-4 h-4" />إضافة منتج
        </Button>
      </div>

      {adding && <ProductForm onSave={(d) => createMut.mutate(d)} onCancel={() => setAdding(false)} />}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <div key={p.id}>
              {editing?.id === p.id ? (
                <ProductForm initial={editing}
                  onSave={(d) => updateMut.mutate({ id: p.id, ...d })}
                  onCancel={() => setEditing(null)} />
              ) : (
                <div className="rounded-xl border p-4 flex items-center gap-4" style={{ borderColor: 'hsl(var(--border))' }}>
                  {p.image_url && <img src={p.image_url} alt={p.name_ar} className="w-14 h-14 rounded-lg object-cover shrink-0" />}
                  {!p.image_url && <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0"><Package className="w-6 h-6 text-muted-foreground" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{p.name_ar}</span>
                      {p.is_featured && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                      <Badge variant="outline">{CATEGORIES[p.category] || p.category}</Badge>
                      <Badge variant={p.in_stock ? 'default' : 'destructive'}>{p.in_stock ? 'متوفر' : 'نفذ'}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{p.description}</p>
                    <span className="text-sm font-bold text-primary">{p.price} ر.س</span>
                    {p.original_price && <span className="text-xs text-muted-foreground line-through mr-2">{p.original_price}</span>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => toggleStock(p)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="تغيير التوفر">
                      {p.in_stock ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <button onClick={() => { setEditing(p); setAdding(false); }} className="p-2 rounded-lg hover:bg-muted transition-colors">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteMut.mutate(p.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}