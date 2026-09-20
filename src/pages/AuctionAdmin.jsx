import React, { useState } from 'react';
import { db } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Gavel, Star } from 'lucide-react';
import ProductImageUploader from '@/components/shop/ProductImageUploader';
import { toast } from 'sonner';

const CATEGORIES = { bags: 'حقائب', shoes: 'أحذية', accessories: 'إكسسوارات', other: 'أخرى' };
const STATUSES = { active: 'نشط', pending: 'بانتظار المراجعة', ended: 'منتهي', sold: 'مباع', cancelled: 'ملغي' };

// نفس ٤ ساعات وقت افتراضي لانتهاء المزاد عند الإضافة — يقدر التاجر يغيّرها
function defaultEndsAt() {
  const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16); // datetime-local format
}

const EMPTY = {
  title: '', title_ar: '', description_ar: '', category: 'bags', condition: 'مزاد نشط',
  brand_id: '', starting_price: '', bid_increment: '10', image_url: '',
  ends_at: defaultEndsAt(), is_featured: false, sort_order: 0,
};

function ListingForm({ initial, brands, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-2xl p-6 mb-6 border" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
      <h3 className="font-bold text-lg mb-5">{initial?.id ? 'تعديل قطعة مزاد' : 'إضافة قطعة مزاد جديدة'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">اسم القطعة بالعربي *</label>
          <Input value={form.title_ar} onChange={(e) => set('title_ar', e.target.value)} placeholder="حقيبة جلد مجدّدة — تصميم فاخر" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">الاسم بالإنجليزي</label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Refurbished Designer Handbag" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">الفئة</label>
          <select value={form.category} onChange={(e) => set('category', e.target.value)}
            className="w-full h-9 rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: 'hsl(var(--border))' }}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">البراند</label>
          <select value={form.brand_id || ''} onChange={(e) => set('brand_id', e.target.value || null)}
            className="w-full h-9 rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: 'hsl(var(--border))' }}>
            <option value="">بدون براند محدد</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name_ar || b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">السعر الابتدائي (ر.س) *</label>
          <Input type="number" value={form.starting_price} onChange={(e) => set('starting_price', e.target.value)} placeholder="500" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">حد الزيادة لكل مزايدة (ر.س)</label>
          <Input type="number" value={form.bid_increment} onChange={(e) => set('bid_increment', e.target.value)} placeholder="10" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">وقت انتهاء المزاد *</label>
          <Input type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">حالة القطعة (نص وصفي)</label>
          <Input value={form.condition} onChange={(e) => set('condition', e.target.value)} placeholder="مزاد نشط" />
        </div>
        <div className="sm:col-span-2">
          <ProductImageUploader value={form.image_url} onChange={(url) => set('image_url', url)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-muted-foreground mb-1 block">الوصف</label>
          <Input value={form.description_ar} onChange={(e) => set('description_ar', e.target.value)} placeholder="وصف مختصر لحالة القطعة وترميمها..." />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
          قطعة مميزة
        </label>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => onSave(form)} className="bg-primary" disabled={!form.title_ar || !form.starting_price || !form.ends_at}>حفظ</Button>
        <Button variant="outline" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );
}

export default function AuctionAdmin() {
  const session = getSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['auction-listings-admin'],
    queryFn: () => db.AuctionListing.list('-created_at', 200),
  });
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-for-auction-admin'],
    queryFn: () => db.Brand.list('sort_order', 100),
  });

  const buildPayload = (d) => ({
    title: d.title || d.title_ar,
    title_ar: d.title_ar,
    description_ar: d.description_ar || null,
    category: d.category,
    condition: d.condition || 'مزاد نشط',
    brand_id: d.brand_id || null,
    starting_price: Number(d.starting_price),
    current_price: d.current_price != null ? Number(d.current_price) : Number(d.starting_price),
    bid_increment: Number(d.bid_increment) || 10,
    image_url: d.image_url || null,
    ends_at: new Date(d.ends_at).toISOString(),
    is_featured: !!d.is_featured,
    sort_order: Number(d.sort_order) || 0,
  });

  const createMut = useMutation({
    mutationFn: (d) => db.AuctionListing.create(buildPayload(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auction-listings-admin'] }); setAdding(false); toast.success('تمت إضافة قطعة المزاد'); },
    onError: (e) => toast.error(`فشل إضافة القطعة: ${e.message || 'خطأ غير معروف'}`),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => db.AuctionListing.update(id, buildPayload(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auction-listings-admin'] }); setEditing(null); toast.success('تم تحديث القطعة'); },
    onError: (e) => toast.error(`فشل تعديل القطعة: ${e.message || 'خطأ غير معروف'}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => db.AuctionListing.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auction-listings-admin'] }); toast.success('تم حذف القطعة'); },
    onError: (e) => toast.error(`فشل حذف القطعة: ${e.message || 'خطأ غير معروف'}`),
  });

  const setStatus = (l, status) => updateMut.mutate({ id: l.id, ...l, ends_at: l.ends_at?.slice(0, 16), status });

  if (!['admin', 'owner', 'manager'].includes(session?.role)) {
    return <div className="p-8 text-center text-muted-foreground">غير مصرح لك بالوصول</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gavel className="w-5 h-5" />إدارة سوق المزاد</h1>
          <p className="text-muted-foreground text-sm">{listings.length} قطعة</p>
        </div>
        <Button onClick={() => { setAdding(true); setEditing(null); }} className="gap-2">
          <Plus className="w-4 h-4" />إضافة قطعة مزاد
        </Button>
      </div>

      {adding && <ListingForm brands={brands} onSave={(d) => createMut.mutate(d)} onCancel={() => setAdding(false)} />}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <div key={l.id}>
              {editing?.id === l.id ? (
                <ListingForm brands={brands} initial={{ ...l, ends_at: l.ends_at?.slice(0, 16), brand_id: l.brand_id || '' }}
                  onSave={(d) => updateMut.mutate({ id: l.id, ...d })} onCancel={() => setEditing(null)} />
              ) : (
                <div className="rounded-xl border p-4 flex items-center gap-4" style={{ borderColor: 'hsl(var(--border))' }}>
                  {l.image_url ? (
                    <img src={l.image_url} alt={l.title_ar} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0"><Gavel className="w-6 h-6 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{l.title_ar}</span>
                      {l.is_featured && <Star className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-400 fill-yellow-500" />}
                      <Badge variant="outline">{CATEGORIES[l.category] || l.category}</Badge>
                      <Badge variant={l.status === 'active' ? 'default' : l.status === 'pending' ? 'destructive' : 'outline'}>{STATUSES[l.status] || l.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      السعر الحالي: <span className="font-bold text-primary">{l.current_price} ر.س</span> · ينتهي: {new Date(l.ends_at).toLocaleString('ar-SA')}
                    </p>
                    {l.submitter_name && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        📨 مقدَّمة من: {l.submitter_name} — <span dir="ltr">{l.submitter_phone}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {l.status === 'active' ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus(l, 'ended')}>إنهاء</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setStatus(l, 'active')}>تفعيل</Button>
                    )}
                    <button onClick={() => { setEditing(l); setAdding(false); }} className="p-2 rounded-lg hover:bg-muted transition-colors">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteMut.mutate(l.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors">
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
