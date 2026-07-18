import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { generateOrderNumber } from '@/lib/barcodeUtils';
import PhotoUploader from '@/components/pos/PhotoUploader';
import ReceiptView from '@/components/pos/ReceiptView';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { isValidVatFormat, normalizeDigits } from '@/lib/vatValidation';
import { toast } from 'sonner';
import {
  PackagePlus, Truck, Store, UserCheck, Star, Gift,
  Scissors, ShoppingCart, Plus, Minus, Trash2, Search
} from 'lucide-react';
import { format } from 'date-fns';
import { useZATCA } from '@/lib/zatca/useZATCA';
import { notifyCustomerDirect } from '@/lib/notifyCustomer';

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

// خدمات كل قطعة حسب نوعها — بناءً على طلب صريح: كل قطعة (حذاء/حقيبة)
// تُسجَّل لحالها بخدماتها الخاصة بدل ما يكون الطلب كامل وصف عام واحد
const SERVICES_BY_TYPE = {
  shoes: ['تلميع', 'تنظيف', 'خياطة', 'دعسات', 'تنعيل', 'أخرى'],
  bag:   ['تلوين', 'صبغات', 'تنظيف', 'خياطة', 'تغيير يد', 'تغيير عجلات', 'رسم', 'أخرى'],
};

function newPiece() {
  return {
    id: Math.random().toString(36).slice(2),
    item_type: 'shoes',
    services: [],
    description: '',
    technician_id: '',
    technician_name: '',
  };
}

const UNITS = { piece: 'حبة', dozen: 'درزن', carton: 'كرتون', kg: 'كغ', liter: 'لتر' };

function genInvoiceNo() {
  return 'INV-' + Date.now().toString().slice(-8);
}

// ─── Cobbler (إسكافي) Tab ─────────────────────────────────────────────────────
function CobblerTab({ session }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState([]);
  const [pieces, setPieces] = useState([newPiece()]);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '',
    delivery_method: 'pickup', delivery_address: '', delivery_date: '', total_price: '',
    payment_status: 'unpaid', payment_method: 'cash', notes: '',
    is_b2b: false, buyer_company_name: '', buyer_vat_number: '', buyer_cr_number: '', buyer_address: '',
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'], queryFn: () => base44.entities.Customer.list(), initialData: [],
  });
  const { data: settingsList = [] } = useQuery({
    queryKey: ['app-settings'], queryFn: () => base44.entities.AppSettings.list(), staleTime: 0,
  });
  const { data: planList2 } = useQuery({
    queryKey: ['operations-plan'], queryFn: () => base44.entities.OperationsPlan.list(), initialData: [],
  });
  // قائمة الفنيين لتخصيص كل قطعة لفني مسؤول عنها
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'], queryFn: () => base44.entities.Employee.list(), initialData: [],
  });
  const technicians = employees.filter(e => e.is_active !== false);

  const { submitInvoice } = useZATCA();
  const shopSettings = settingsList[0] || {};
  const freeAfterUI = planList2[0]?.loyalty_free_after || 4;
  const knownCustomer = form.customer_phone.length >= 9
    ? customers.find(c => c.phone === form.customer_phone)
    : null;

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addPiece = () => setPieces(prev => [...prev, newPiece()]);
  const removePiece = (id) => setPieces(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  const updatePiece = (id, field, value) => setPieces(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  const setPieceTechnician = (id, techId) => {
    const tech = technicians.find(t => t.id === techId);
    setPieces(prev => prev.map(p => p.id === id ? { ...p, technician_id: techId, technician_name: tech?.name || '' } : p));
  };
  const toggleService = (id, service) => setPieces(prev => prev.map(p => {
    if (p.id !== id) return p;
    const has = p.services.includes(service);
    return { ...p, services: has ? p.services.filter(s => s !== service) : [...p.services, service] };
  }));

  const createOrder = useMutation({
    mutationFn: async (orderData) => {
      const order = await base44.entities.Order.create(orderData);
      const price = parseFloat(form.total_price) || 0;
      const pointsEarned = Math.floor(price / 10);
      const planList = await base44.entities.OperationsPlan.list();
      const freeAfter = planList[0]?.loyalty_free_after || 4;

      // نتأكد من القاعدة مباشرة (مو من الكاش المحلي) لتفادي محاولة إنشاء
      // عميل مكرر برقم جوال موجود أصلاً (customers_phone_key)
      const freshMatches = await base44.entities.Customer.filter({ phone: form.customer_phone });
      const existingCustomer = freshMatches?.[0];

      if (existingCustomer) {
        const newStamps = (existingCustomer.stamps || 0) + 1;
        const resetStamps = newStamps >= freeAfter;
        await base44.entities.Customer.update(existingCustomer.id, {
          loyalty_points: (existingCustomer.loyalty_points || 0) + pointsEarned,
          stamps: resetStamps ? 0 : newStamps,
          total_orders: (existingCustomer.total_orders || 0) + 1,
          total_spent: (existingCustomer.total_spent || 0) + price,
        });
        // إشعار مباشر بجوال العميل — بدون أي خطوة يدوية إضافية
        if (existingCustomer.phone) {
          const msg = resetStamps
            ? `يا هلا ${existingCustomer.name}! 🎉 تهانينا! أكملت ${freeAfter} خدمات وحصلت على خدمتك المجانية القادمة! ✂️ إبرة وخيط الإسكافي`
            : `يا هلا ${existingCustomer.name}! أضفنا ${pointsEarned} نقطة لحسابك (${newStamps}/${freeAfter} نحو خدمتك المجانية القادمة) ✂️ إبرة وخيط الإسكافي`;
          notifyCustomerDirect(existingCustomer.phone, msg);
        }
      } else {
        try {
          await base44.entities.Customer.create({
            name: form.customer_name, phone: form.customer_phone,
            loyalty_points: pointsEarned, stamps: 1, total_orders: 1, total_spent: price,
          });
          if (form.customer_phone) {
            notifyCustomerDirect(form.customer_phone,
              `يا هلا ${form.customer_name}! سجّلناك ببرنامج الولاء وأضفنا ${pointsEarned} نقطة لحسابك (1/${freeAfter} نحو خدمتك المجانية القادمة) ✂️ إبرة وخيط الإسكافي`);
          }
        } catch (custErr) {
          // تعارض نادر (Race Condition): نفس الرقم انسجل بلحظة موازية — نحدّثه بدل ما نفشل الطلب كامل
          const retryMatch = (await base44.entities.Customer.filter({ phone: form.customer_phone }))?.[0];
          if (retryMatch) {
            await base44.entities.Customer.update(retryMatch.id, {
              loyalty_points: (retryMatch.loyalty_points || 0) + pointsEarned,
              stamps: (retryMatch.stamps || 0) + 1,
              total_orders: (retryMatch.total_orders || 0) + 1,
              total_spent: (retryMatch.total_spent || 0) + price,
            });
          } else {
            throw custErr;
          }
        }
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

      // ── ZATCA Phase 2 — طلبات الإصلاح تُفوتر رسمياً مثل المبيعات تماماً ──
      // (سابقاً: طلبات الإصلاح ما كانت تولّد فاتورة إلكترونية معتمدة إطلاقاً)
      const zatcaResult = await submitInvoice('order', order.id);
      return { ...order, _zatca: zatcaResult };
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (order._zatca?.zatcaStatus === 'REPORTED') {
        toast.success('تم إنشاء الطلب وإبلاغه لزاتكا رسمياً ✅');
      } else {
        toast.success('تم إنشاء الطلب — لكن إرسال زاتكا واجه مشكلة، راجع سجل زاتكا');
      }
      navigate(`/orders/${order.id}`, { state: { justCreated: true } });
    },
    onError: (e) => toast.error(`فشل حفظ الطلب: ${e.message || 'خطأ غير معروف'}`),
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.delivery_date) {
      toast.error('تاريخ التسليم مطلوب — لازم تحدده قبل حفظ الطلب');
      return;
    }

    const incompletePiece = pieces.find(p =>
      !p.description.trim() && p.services.length === 0
    );
    if (incompletePiece) {
      toast.error('كل قطعة لازم تحدد لها الخدمة المطلوبة أو وصف — راجع القطع المضافة');
      return;
    }

    const price = parseFloat(form.total_price) || 0;
    const vatEnabled = shopSettings.vat_enabled !== false;
    const vatAmount = vatEnabled ? parseFloat((price - price / 1.15).toFixed(2)) : 0;
    const subtotal = vatEnabled ? parseFloat((price / 1.15).toFixed(2)) : price;

    // وصف عام يجمع كل القطع — يستمر يظهر بصفحة «مهامي» للعامل ولأي كود
    // قديم يعتمد على حقل notes/description النصي فقط
    const combinedNotes = pieces.map((p, i) => {
      const typeLabel = ITEM_TYPES.find(t => t.value === p.item_type)?.label || p.item_type;
      const svc = p.services.length ? ` [${p.services.join('، ')}]` : '';
      const tech = p.technician_name ? ` — الفني: ${p.technician_name}` : '';
      return `قطعة ${i + 1} (${typeLabel})${svc}${tech}${p.description ? `: ${p.description}` : ''}`;
    }).join('\n');

    // النوع/الكمية العامين على مستوى الطلب يُشتقّان تلقائياً من عدد
    // ونوع القطع الفعلية — بدل ما يختارهم الموظف يدوياً بمعزل عن القطع
    const firstType = pieces[0]?.item_type;
    const overallType = pieces.every(p => p.item_type === firstType) ? firstType : 'other';

    createOrder.mutate({
      order_number: generateOrderNumber(),
      employee_id: session?.id || null,
      employee_name: session?.name || '',
      branch_id: session?.branch_id || null,
      branch_name: session?.branch_name || '',
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      is_b2b: form.is_b2b,
      buyer_company_name: form.is_b2b ? form.buyer_company_name : null,
      buyer_vat_number: form.is_b2b ? normalizeDigits(form.buyer_vat_number.trim()) : null,
      buyer_cr_number: form.is_b2b ? form.buyer_cr_number : null,
      buyer_address: form.is_b2b ? form.buyer_address : null,
      item_type: overallType,
      quantity: pieces.length,
      order_items: pieces.map(p => ({
        item_type: p.item_type, services: p.services, description: p.description,
        technician_id: p.technician_id || null, technician_name: p.technician_name || '',
      })),
      photos,
      delivery_method: form.delivery_method,
      delivery_address: form.delivery_method === 'delivery' ? form.delivery_address : '',
      delivery_date: form.delivery_date,
      subtotal, vat_amount: vatAmount, total_price: price,
      payment_status: form.payment_status,
      payment_method: form.payment_method,
      status: 'pending',
      notes: combinedNotes,
      description: combinedNotes,
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

          {/* فاتورة شركة (B2B) — تُضاف بيانات المشتري (الشركة) هنا فتظهر
              بالفاتورة كفاتورة صادرة لمنشأة، لا لفرد */}
          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'hsl(var(--border))' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">فاتورة لشركة (B2B)</p>
                <p className="text-xs text-muted-foreground">فعّلها إذا العميل منشأة/شركة، لإدراج اسمها ورقمها الضريبي وسجلها التجاري بالفاتورة</p>
              </div>
              <Switch checked={form.is_b2b} onCheckedChange={v => update('is_b2b', v)} />
            </div>
            {form.is_b2b && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>اسم الشركة *</Label>
                  <Input value={form.buyer_company_name} onChange={e => update('buyer_company_name', e.target.value)}
                    placeholder="الاسم النظامي للمنشأة" required={form.is_b2b} />
                </div>
                <div className="space-y-1.5">
                  <Label>الرقم الضريبي للشركة *</Label>
                  <Input value={form.buyer_vat_number} onChange={e => update('buyer_vat_number', e.target.value)}
                    placeholder="15 رقم" required={form.is_b2b} />
                  {form.buyer_vat_number && !isValidVatFormat(form.buyer_vat_number) && (
                    <p className="text-[11px] text-amber-600">لازم 15 رقم ويبدأ وينتهي بـ 3</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>السجل التجاري (اختياري)</Label>
                  <Input value={form.buyer_cr_number} onChange={e => update('buyer_cr_number', e.target.value)} placeholder="رقم السجل التجاري" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>عنوان الشركة (اختياري)</Label>
                  <Input value={form.buyer_address} onChange={e => update('buyer_address', e.target.value)} placeholder="المدينة، الحي، الشارع" />
                </div>
              </div>
            )}
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

      {/* Item Details — كل قطعة (حذاء/حقيبة...) تُسجَّل لحالها بخدماتها
          الخاصة وفنيها المسؤول، بدل وصف عام واحد لكل الطلب */}
      <Card>
        <CardHeader className="pb-4 flex-row items-center justify-between">
          <CardTitle className="text-base">القطع ({pieces.length})</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addPiece} className="gap-1.5">
            <Plus className="w-4 h-4" /> إضافة قطعة
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {pieces.map((piece, idx) => {
            const services = SERVICES_BY_TYPE[piece.item_type];
            return (
              <div key={piece.id} className="rounded-xl border p-4 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground">قطعة {idx + 1}</span>
                  {pieces.length > 1 && (
                    <button type="button" onClick={() => removePiece(piece.id)} className="text-destructive hover:text-destructive/70">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">نوع القطعة *</Label>
                    <Select value={piece.item_type} onValueChange={v => updatePiece(piece.id, 'item_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">الفني المسؤول</Label>
                    <Select value={piece.technician_id} onValueChange={v => setPieceTechnician(piece.id, v)}>
                      <SelectTrigger><SelectValue placeholder="اختر الفني" /></SelectTrigger>
                      <SelectContent>
                        {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* اختيار متعدد باللمس — يظهر فقط لأنواع فيها خدمات محددة
                    (أحذية/حقائب)، وباقي الأنواع تعتمد على الوصف الحر */}
                {services && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">نوع الخدمة (يمكن اختيار أكثر من واحدة)</Label>
                    <div className="flex flex-wrap gap-2">
                      {services.map(s => {
                        const active = piece.services.includes(s);
                        return (
                          <button
                            key={s} type="button"
                            onClick={() => toggleService(piece.id, s)}
                            className={`px-3.5 py-2 rounded-full text-sm font-medium border-2 transition-all select-none ${
                              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">وصف إضافي لهذي القطعة (يظهر للفني)</Label>
                  <Textarea
                    value={piece.description}
                    onChange={e => updatePiece(piece.id, 'description', e.target.value)}
                    placeholder="مثال: انتبه للخيط الجانبي، اللون البني الغامق..."
                    className="h-16 text-sm"
                  />
                </div>
              </div>
            );
          })}

          <PhotoUploader photos={photos} setPhotos={setPhotos} maxPhotos={5} />
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
          <div className="space-y-2">
            <Label>تاريخ التسليم *</Label>
            <Input type="date" min={format(new Date(), 'yyyy-MM-dd')} value={form.delivery_date}
              onChange={e => update('delivery_date', e.target.value)} required />
            <p className="text-xs text-muted-foreground">يظهر الطلب في صفحة التقويم/المهام باليوم المحدد هنا</p>
          </div>
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

      <Button type="submit" disabled={createOrder.isPending || !form.customer_name || !form.total_price || pieces.length === 0}
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
  const [customer, setCustomer] = useState({ name: '', phone: '', is_b2b: false, buyer_company_name: '', buyer_vat_number: '', buyer_cr_number: '', buyer_address: '' });
  const [selectedBranch, setSelectedBranch] = useState(session?.branch_id || '');
  const [payMethod, setPayMethod] = useState('cash');
  const [search, setSearch] = useState('');
  const [printInvoice, setPrintInvoice] = useState(null);

  const { data: items } = useQuery({
    queryKey: ['inventory-items'], queryFn: () => base44.entities.InventoryItem.list('-created_at', 500), initialData: [],
  });
  const { data: branches } = useQuery({
    queryKey: ['branches'], queryFn: () => base44.entities.Branch.list(), initialData: [],
  });
  const { data: planList } = useQuery({
    queryKey: ['operations-plan'], queryFn: () => base44.entities.OperationsPlan.list(), initialData: [],
  });
  const freeAfter = planList[0]?.loyalty_free_after || 4;

  const salesBranches = branches.filter(b => b.is_active);

  // Auto-select branch from session
  useEffect(() => {
    if (session?.branch_id && !selectedBranch) setSelectedBranch(session.branch_id);
  }, [session?.branch_id]);

  // كانت هذي القائمة تُخفي أي منتج ما عنده مخزون مُحوَّل لهذا الفرع تحديداً
  // بالكامل — فمنتج جديد أضافه الأدمن بقسم المنتجات (بالمستودع) بس ما حوّله
  // لفرع بعد كان يختفي تماماً من شاشة الفاتورة وكأنه غير موجود إطلاقاً.
  // الآن نعرض كل المنتجات دائماً، ونميّز فقط المتوفر فعلياً بهذا الفرع
  // (قابل للإضافة) عن المتوفر بالمستودع فقط (يحتاج تحويل أولاً)
  const branchItems = useMemo(() => {
    if (!selectedBranch) return [];
    return items
      .filter(i => i.category !== 'workshop' &&
        (!search || i.name?.toLowerCase().includes(search.toLowerCase())))
      .map(i => ({ ...i, _branchQty: (i.branch_qty || {})[selectedBranch] || 0 }))
      .sort((a, b) => (b._branchQty > 0) - (a._branchQty > 0));
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
      if (customer.is_b2b && (!customer.buyer_company_name || !isValidVatFormat(customer.buyer_vat_number))) {
        throw new Error('لإصدار فاتورة شركة (B2B) لازم اسم الشركة ورقم ضريبي صحيح (15 رقم يبدأ وينتهي بـ 3)');
      }
      const branch = branches.find(b => b.id === selectedBranch);
      const monthKey = format(new Date(), 'yyyy-MM');

      const invoice = await base44.entities.SalesInvoice.create({
        invoice_number: genInvoiceNo(),
        customer_name: customer.name || 'عميل نقدي',
        customer_phone: customer.phone,
        is_b2b: customer.is_b2b,
        buyer_company_name: customer.is_b2b ? customer.buyer_company_name : null,
        buyer_vat_number: customer.is_b2b ? normalizeDigits(customer.buyer_vat_number.trim()) : null,
        buyer_cr_number: customer.is_b2b ? customer.buyer_cr_number : null,
        buyer_address: customer.is_b2b ? customer.buyer_address : null,
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
      // ── ربط برنامج الولاء بفاتورة المنتجات (كان مفعّل فقط بطلبات الإصلاح) ──
      if (customer.phone) {
        const pointsEarned = Math.floor(total / 10);
        const freshMatches = await base44.entities.Customer.filter({ phone: customer.phone });
        const existingCustomer = freshMatches?.[0];
        if (existingCustomer) {
          const newStamps = (existingCustomer.stamps || 0) + 1;
          const resetStamps = newStamps >= freeAfter;
          await base44.entities.Customer.update(existingCustomer.id, {
            loyalty_points: (existingCustomer.loyalty_points || 0) + pointsEarned,
            stamps: resetStamps ? 0 : newStamps,
            total_orders: (existingCustomer.total_orders || 0) + 1,
            total_spent: (existingCustomer.total_spent || 0) + total,
          });
          const msg = resetStamps
            ? `يا هلا ${existingCustomer.name}! 🎉 تهانينا! أكملت ${freeAfter} خدمات وحصلت على خدمتك المجانية القادمة! ✂️ إبرة وخيط الإسكافي`
            : `يا هلا ${existingCustomer.name}! أضفنا ${pointsEarned} نقطة لحسابك (${newStamps}/${freeAfter} نحو خدمتك المجانية القادمة) ✂️ إبرة وخيط الإسكافي`;
          notifyCustomerDirect(existingCustomer.phone, msg);
        } else {
          try {
            await base44.entities.Customer.create({
              name: customer.name || 'عميل نقدي', phone: customer.phone,
              loyalty_points: pointsEarned, stamps: 1, total_orders: 1, total_spent: total,
            });
            notifyCustomerDirect(customer.phone,
              `يا هلا ${customer.name || ''}! سجّلناك ببرنامج الولاء وأضفنا ${pointsEarned} نقطة لحسابك (1/${freeAfter} نحو خدمتك المجانية القادمة) ✂️ إبرة وخيط الإسكافي`);
          } catch { /* رقم مكرر بلحظة موازية — نتجاهل، مو حرج بفاتورة بيع */ }
        }
      }

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] }); // كانت ناقصة: فاتورة المنتجات تنشئ/تحدّث عميل لكن ما كانت تحدّث كاش صفحة العملاء
      toast.success('تم إصدار الفاتورة وخصم المخزون ✅');
      setCart([]);
      setCustomer({ name: '', phone: '', is_b2b: false, buyer_company_name: '', buyer_vat_number: '', buyer_cr_number: '', buyer_address: '' });
      setPrintInvoice(invoice); // تُطبع تلقائياً فوراً بنفس حجم إيصال الماركت الصغير، تماماً مثل طلب الإصلاح
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
            {branchItems.map(item => {
              const available = item._branchQty > 0;
              return (
                <button key={item.id} onClick={() => available && addToCart(item)} type="button" disabled={!available}
                  title={!available ? 'المنتج موجود بالمستودع فقط — يحتاج تحويل إلى هذا الفرع من صفحة المبيعات والمخازن' : ''}
                  className={`rounded-xl border p-3 text-right transition-all ${available ? 'hover:border-primary hover:bg-primary/5' : 'opacity-50 cursor-not-allowed bg-muted/30'}`}>
                  <p className="font-medium text-sm mb-1 line-clamp-1">{item.name}</p>
                  {available ? (
                    <p className="text-xs text-muted-foreground">متوفر: {item._branchQty} {UNITS[item.unit] || item.unit}</p>
                  ) : (
                    <p className="text-xs text-amber-600 font-medium">
                      {(item.warehouse_qty || 0) > 0 ? 'بالمستودع فقط — يحتاج تحويل' : 'نفد المخزون'}
                    </p>
                  )}
                  <p className="text-sm font-bold text-primary mt-1">{item.sell_price} ر.س</p>
                </button>
              );
            })}
            {branchItems.length === 0 && (
              <div className="col-span-3 text-center py-10 text-muted-foreground text-sm">لا توجد منتجات مطابقة للبحث</div>
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

            <div className="rounded-lg border p-2.5 space-y-2" style={{ borderColor: 'hsl(var(--border))' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">فاتورة لشركة (B2B)</span>
                <Switch checked={customer.is_b2b} onCheckedChange={v => setCustomer(p => ({ ...p, is_b2b: v }))} />
              </div>
              {customer.is_b2b && (
                <div className="grid grid-cols-1 gap-2">
                  <Input placeholder="اسم الشركة *" value={customer.buyer_company_name}
                    onChange={e => setCustomer(p => ({ ...p, buyer_company_name: e.target.value }))} className="text-sm" />
                  <Input placeholder="الرقم الضريبي للشركة * (15 رقم)" value={customer.buyer_vat_number}
                    onChange={e => setCustomer(p => ({ ...p, buyer_vat_number: e.target.value }))} className="text-sm" />
                  {customer.buyer_vat_number && !isValidVatFormat(customer.buyer_vat_number) && (
                    <p className="text-[10px] text-amber-600">لازم 15 رقم ويبدأ وينتهي بـ 3</p>
                  )}
                  <Input placeholder="السجل التجاري (اختياري)" value={customer.buyer_cr_number}
                    onChange={e => setCustomer(p => ({ ...p, buyer_cr_number: e.target.value }))} className="text-sm" />
                  <Input placeholder="عنوان الشركة (اختياري)" value={customer.buyer_address}
                    onChange={e => setCustomer(p => ({ ...p, buyer_address: e.target.value }))} className="text-sm" />
                </div>
              )}
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

      {/* طباعة الفاتورة تلقائياً فور الإصدار — نفس حجم إيصال الماركت الصغير */}
      <Dialog open={!!printInvoice} onOpenChange={(o) => !o && setPrintInvoice(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {printInvoice && (
            <>
              <ReceiptView order={printInvoice} autoPrint />
              <div className="p-3 border-t">
                <Button className="w-full" variant="outline" onClick={() => setPrintInvoice(null)}>إغلاق</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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