import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { generateOrderNumber } from '@/lib/barcodeUtils';
import PhotoUploader from '@/components/pos/PhotoUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  PackagePlus, Truck, Store, UserCheck, Star, Gift,
  Scissors, ShoppingCart, Plus, Minus, Trash2, Search
} from 'lucide-react';
import { format } from 'date-fns';

const ITEM_TYPES = [
  { value: 'shoes', label: 'أحذية' },
  { value: 'bag', label: 'حقيبة' },
  { value: 'dress', label: 'فستان' },
  { value: 'suit', label: 'بدلة' },
  { value: 'jacket', label: 'جاكيت' },
  { value: 'pants', label: 'بنطال' },
  { value: 'shirt', label: 'قميص' },
  { value: 'other', label: 'أخرى' },
];

const UNITS = { piece: 'حبة', dozen: 'درزن', carton: 'كرتون', kg: 'كغ', liter: 'لتر' };

function genInvoiceNo() {
  return 'INV-' + Date.now().toString().slice(-8);
}

// ─── Cobbler (إسكافي) Tab ─────────────────────────────────────────────────────
function CobblerTab({ session }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState([]);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', item_type: '', quantity: 1,
    delivery_method: 'pickup', delivery_address: '', total_price: '',
    payment_status: 'unpaid', payment_method: 'cash', notes: '',
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'], queryFn: () => base44.entities.Customer.list(), initialData: [],
  });
  const { data: settingsList = [] } = useQuery({
    queryKey: ['shop-settings'], queryFn: () => base44.entities.ShopSettings.list(),
  });
  const { data: planList2 } = useQuery({
    queryKey: ['operations-plan'], queryFn: () => base44.entities.OperationsPlan.list(), initialData: [],
  });

  const shopSettings = settingsList[0] || {};
  const freeAfterUI = planList2[0]?.loyalty_free_after || 3;
  const knownCustomer = form.customer_phone.length >= 9
    ? customers.find(c => c.phone === form.customer_phone)
    : null;

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const createOrder = useMutation({
    mutationFn: async (orderData) => {
      const order = await base44.entities.Order.create(orderData);
      const existingCustomer = customers.find(c => c.phone === form.customer_phone);
      const price = parseFloat(form.total_price) || 0;
      const pointsEarned = Math.floor(price / 10);
      const planList = await base44.entities.OperationsPlan.list();
      const freeAfter = planList[0]?.loyalty_free_after || 3;

      if (existingCustomer) {
        const newStamps = (existingCustomer.stamps || 0) + 1;
        const resetStamps = newStamps >= freeAfter;
        await base44.entities.Customer.update(existingCustomer.id, {
          loyalty_points: (existingCustomer.loyalty_points || 0) + pointsEarned,
          stamps: resetStamps ? 0 : newStamps,
          total_orders: (existingCustomer.total_orders || 0) + 1,
          total_spent: (existingCustomer.total_spent || 0) + price,
        });
        if (resetStamps && existingCustomer.phone) {
          const phone = existingCustomer.phone.replace(/^0/, '966').replace(/\D/g, '');
          const msg = encodeURIComponent(`يا هلا ${existingCustomer.name}! 🎉\nتهانينا! لقد أكملت ${freeAfter} خدمات وحصلت على خدمتك المجانية القادمة! ✂️\nإبرة وخيط الإسكافي`);
          setTimeout(() => window.open(`https://wa.me/${phone}?text=${msg}`, '_blank'), 2000);
        }
      } else {
        await base44.entities.Customer.create({
          name: form.customer_name, phone: form.customer_phone,
          loyalty_points: pointsEarned, stamps: 1, total_orders: 1, total_spent: price,
        });
      }

      if (session?.id) {
        const emp = await base44.entities.Employee.list();
        const me = emp.find(e => e.id === session.id);
        if (me) {
          await base44.entities.Employee.update(me.id, {
            total_orders: (me.total_orders || 0) + 1,
            total_revenue: (me.total_revenue || 0) + price,
          });
        }
      }
      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('تم إنشاء الطلب بنجاح!');
      navigate(`/orders/${order.id}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const price = parseFloat(form.total_price) || 0;
    const vatEnabled = shopSettings.vat_enabled !== false;
    const vatAmount = vatEnabled ? parseFloat((price - price / 1.15).toFixed(2)) : 0;
    const subtotal = vatEnabled ? parseFloat((price / 1.15).toFixed(2)) : price;

    createOrder.mutate({
      order_number: generateOrderNumber(),
      employee_id: session?.id || '',
      employee_name: session?.name || '',
      branch_id: session?.branch_id || '',
      branch_name: session?.branch_name || '',
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      item_type: form.item_type,
      quantity: parseInt(form.quantity) || 1,
      photos,
      delivery_method: form.delivery_method,
      delivery_address: form.delivery_method === 'delivery' ? form.delivery_address : '',
      subtotal, vat_amount: vatAmount, total_price: price,
      payment_status: form.payment_status,
      payment_method: form.payment_method,
      order_status: 'pending',
      notes: form.notes,
      points_earned: Math.floor(price / 10),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Info */}
      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">بيانات العميل</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم العميل *</Label>
              <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="الاسم الكامل" required />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input value={form.customer_phone} onChange={e => {
                update('customer_phone', e.target.value);
                const found = customers.find(c => c.phone === e.target.value);
                if (found && !form.customer_name) update('customer_name', found.name);
              }} placeholder="05XXXXXXXX" />
            </div>
          </div>
          {knownCustomer && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-bold">{knownCustomer.name} — عميل معروف ✅</p>
                  <p className="text-xs text-muted-foreground">{knownCustomer.total_orders || 0} طلب · {(knownCustomer.total_spent || 0).toFixed(0)} ر.س</p>
                </div>
              </div>
              <div>
                {(knownCustomer.stamps || 0) >= freeAfterUI - 1 ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <Gift className="w-3 h-3" />يستحق مجاناً!
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="w-3 h-3 text-primary" />
                    {knownCustomer.stamps || 0}/{freeAfterUI} طوابع
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Item Details */}
      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">تفاصيل القطعة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>نوع القطعة *</Label>
              <Select value={form.item_type} onValueChange={v => update('item_type', v)} required>
                <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الكمية</Label>
              <Input type="number" min={1} value={form.quantity} onChange={e => update('quantity', e.target.value)} />
            </div>
          </div>
          <PhotoUploader photos={photos} setPhotos={setPhotos} maxPhotos={5} />
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="تعليمات خاصة..." className="h-20" />
          </div>
        </CardContent>
      </Card>

      {/* Delivery */}
      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">التسليم</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => update('delivery_method', 'pickup')}
              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${form.delivery_method === 'pickup' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
              <Store className={`w-5 h-5 ${form.delivery_method === 'pickup' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="font-medium">استلام من المحل</span>
            </button>
            <button type="button" onClick={() => update('delivery_method', 'delivery')}
              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${form.delivery_method === 'delivery' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
              <Truck className={`w-5 h-5 ${form.delivery_method === 'delivery' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="font-medium">توصيل</span>
            </button>
          </div>
          {form.delivery_method === 'delivery' && (
            <div className="space-y-2">
              <Label>عنوان التوصيل</Label>
              <Input value={form.delivery_address} onChange={e => update('delivery_address', e.target.value)} placeholder="العنوان الكامل" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">الدفع</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>السعر الإجمالي (ر.س) *</Label>
            <Input type="number" min={0} step={0.01} value={form.total_price}
              onChange={e => update('total_price', e.target.value)} placeholder="0.00" required className="text-xl font-bold h-14" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>حالة الدفع</Label>
              <Select value={form.payment_status} onValueChange={v => update('payment_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">مدفوع</SelectItem>
                  <SelectItem value="unpaid">غير مدفوع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={form.payment_method} onValueChange={v => update('payment_method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقداً</SelectItem>
                  <SelectItem value="network">شبكة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={createOrder.isPending || !form.customer_name || !form.item_type || !form.total_price}
        className="w-full h-14 text-lg font-bold">
        {createOrder.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'إنشاء الطلب'}
      </Button>
    </form>
  );
}

// ─── Products Invoice Tab ─────────────────────────────────────────────────────
function ProductsTab({ session }) {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [selectedBranch, setSelectedBranch] = useState(session?.branch_id || '');
  const [payMethod, setPayMethod] = useState('cash');
  const [search, setSearch] = useState('');

  const { data: items } = useQuery({
    queryKey: ['inventory-items'], queryFn: () => base44.entities.InventoryItem.list('-created_date', 200), initialData: [],
  });
  const { data: branches } = useQuery({
    queryKey: ['branches'], queryFn: () => base44.entities.Branch.list(), initialData: [],
  });

  const salesBranches = branches.filter(b => b.is_active);

  // Auto-select branch from session
  useEffect(() => {
    if (session?.branch_id && !selectedBranch) setSelectedBranch(session.branch_id);
  }, [session?.branch_id]);

  const branchItems = useMemo(() => {
    if (!selectedBranch) return [];
    return items.filter(i => i.category !== 'workshop' &&
      ((i.branch_qty || {})[selectedBranch] || 0) > 0 &&
      (!search || i.name?.toLowerCase().includes(search.toLowerCase())));
  }, [items, selectedBranch, search]);

  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(c => c.item_id === item.id);
      const avail = (item.branch_qty || {})[selectedBranch] || 0;
      if (ex) {
        if (ex.qty >= avail) { toast.error('لا يوجد مخزون كافٍ'); return prev; }
        return prev.map(c => c.item_id === item.id ? {...c, qty: c.qty + 1} : c);
      }
      if (avail < 1) { toast.error('نفد المخزون'); return prev; }
      return [...prev, { item_id: item.id, item_name: item.name, unit: item.unit, sell_price: item.sell_price || 0, cost_price: item.cost_price || 0, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c.item_id === id ? {...c, qty: Math.max(1, c.qty + delta)} : c));
  };

  const subtotal = cart.reduce((s, c) => s + c.sell_price * c.qty, 0);
  const vatAmt = subtotal * 0.15;
  const total = subtotal + vatAmt;
  const costTotal = cart.reduce((s, c) => s + c.cost_price * c.qty, 0);
  const grossProfit = subtotal - costTotal;

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!selectedBranch) throw new Error('اختر الفرع أولاً');
      if (cart.length === 0) throw new Error('الفاتورة فارغة');
      const branch = branches.find(b => b.id === selectedBranch);
      const monthKey = format(new Date(), 'yyyy-MM');

      const invoice = await base44.entities.SalesInvoice.create({
        invoice_number: genInvoiceNo(),
        customer_name: customer.name || 'عميل نقدي',
        customer_phone: customer.phone,
        branch_id: selectedBranch, branch_name: branch?.name || '',
        items: cart, subtotal, vat_amount: vatAmt, total,
        cost_total: costTotal, gross_profit: grossProfit,
        payment_method: payMethod, payment_status: 'paid',
        month_key: monthKey, employee_name: session?.name || '',
      });

      // Deduct from branch stock + record movements
      for (const line of cart) {
        const inv = items.find(i => i.id === line.item_id);
        if (!inv) continue;
        const bqty = { ...(inv.branch_qty || {}) };
        bqty[selectedBranch] = Math.max(0, (bqty[selectedBranch] || 0) - line.qty);
        await base44.entities.InventoryItem.update(inv.id, { branch_qty: bqty });
        await base44.entities.StockMovement.create({
          item_id: inv.id, item_name: inv.name, movement_type: 'branch_sale',
          quantity: line.qty, unit: inv.unit,
          from_location: selectedBranch, to_location: 'customer',
          cost_price: inv.cost_price, sell_price: inv.sell_price,
          reference_id: invoice.id, reference_type: 'invoice',
          branch_id: selectedBranch, branch_name: branch?.name,
          created_by_name: session?.name,
        });
      }
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast.success('تم إصدار الفاتورة وخصم المخزون ✅');
      setCart([]);
      setCustomer({ name: '', phone: '' });
    },
    onError: (e) => toast.error(`فشل إصدار الفاتورة: ${e.message || 'خطأ غير معروف'}`),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Products grid */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-44"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
            <SelectContent>
              {salesBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في المنتجات..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
        </div>

        {!selectedBranch ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>اختر الفرع لعرض المنتجات المتاحة</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {branchItems.map(item => (
              <button key={item.id} onClick={() => addToCart(item)} type="button"
                className="rounded-xl border p-3 text-right hover:border-primary hover:bg-primary/5 transition-all">
                <p className="font-medium text-sm mb-1 line-clamp-1">{item.name}</p>
                <p className="text-xs text-muted-foreground">متوفر: {(item.branch_qty || {})[selectedBranch] || 0} {UNITS[item.unit] || item.unit}</p>
                <p className="text-sm font-bold text-primary mt-1">{item.sell_price} ر.س</p>
              </button>
            ))}
            {branchItems.length === 0 && (
              <div className="col-span-3 text-center py-10 text-muted-foreground text-sm">لا توجد منتجات في هذا الفرع</div>
            )}
          </div>
        )}
      </div>

      {/* Cart */}
      <div>
        <Card className="sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />الفاتورة الحالية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="اسم العميل" value={customer.name} onChange={e => setCustomer(p => ({...p, name: e.target.value}))} className="text-sm" />
              <Input placeholder="رقم الهاتف" value={customer.phone} onChange={e => setCustomer(p => ({...p, phone: e.target.value}))} className="text-sm" />
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
                اضغط على منتج لإضافته
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(line => (
                  <div key={line.item_id} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{line.item_name}</p>
                      <p className="text-xs text-muted-foreground">{line.sell_price} ر.س × {line.qty}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQty(line.item_id, -1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold">{line.qty}</span>
                      <button type="button" onClick={() => updateQty(line.item_id, 1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => setCart(prev => prev.filter(c => c.item_id !== line.item_id))} className="w-6 h-6 rounded-md text-destructive flex items-center justify-center">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>قبل الضريبة</span><span>{subtotal.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ضريبة 15%</span><span>{vatAmt.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>الإجمالي</span><span className="text-primary">{total.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-xs text-green-600">
                <span>الربح الإجمالي</span><span>{grossProfit.toFixed(2)} ر.س</span>
              </div>
            </div>

            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقداً</SelectItem>
                <SelectItem value="network">شبكة</SelectItem>
                <SelectItem value="credit">آجل</SelectItem>
              </SelectContent>
            </Select>

            <Button className="w-full" disabled={cart.length === 0 || createInvoice.isPending} onClick={() => createInvoice.mutate()} type="button">
              {createInvoice.isPending ? 'جاري الإصدار...' : 'إصدار الفاتورة ✅'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NewOrder() {
  const session = getSession();
  const [mode, setMode] = useState('cobbler'); // 'cobbler' | 'products'

  return (
    <div className="max-w-4xl mx-auto" dir="rtl">
      {/* Header with mode toggle */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <PackagePlus className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">طلب جديد</h1>
          <p className="text-sm text-muted-foreground">اختر نوع العملية</p>
        </div>
      </div>

      {/* Mode Switcher — big toggle at top */}
      <div className="flex rounded-2xl border-2 border-border p-1 mb-6 bg-muted/30 gap-1">
        <button
          type="button"
          onClick={() => setMode('cobbler')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm transition-all ${
            mode === 'cobbler'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Scissors className="w-4 h-4" />
          إسكافي — طلب إصلاح
        </button>
        <button
          type="button"
          onClick={() => setMode('products')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm transition-all ${
            mode === 'products'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          منتجات — فاتورة مبيعات
        </button>
      </div>

      {/* Tabs content — kept mounted so data isn't lost on switch */}
      <div style={{ display: mode === 'cobbler' ? 'block' : 'none' }}>
        <CobblerTab session={session} />
      </div>
      <div style={{ display: mode === 'products' ? 'block' : 'none' }}>
        <ProductsTab session={session} />
      </div>
    </div>
  );
}