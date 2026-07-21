/**
 * Purchasing — وحدة إدارة المشتريات
 * ─────────────────────────────────────────────────────────────
 * تسجيل فواتير الشراء من الموردين، مع:
 *  - حقول الضريبة (رقم الفاتورة، تاريخها، المبلغ الخاضع للضريبة، قيمة الضريبة)
 *  - تصنيف ضريبي (مادة خام خاضعة 15% / مصروف آخر)
 *  - أرشفة مستند الفاتورة (صورة/PDF) — مطلب قانوني
 *  - مساعد OCR اختياري لتعبئة الحقول تلقائياً من صورة الفاتورة
 *  - ربط بنود الفاتورة بمواد المخزون (لتبرير أن الشراء لنشاط خاضع للضريبة)
 *  - تنبيه فوري لو المورد بدون رقم ضريبي صالح (الفاتورة لن تُقبل بالإقرار)
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { getSession } from '@/lib/sessionStore';
import { FINANCE_ROLES } from '@/lib/roles';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  ShoppingBag, Plus, Pencil, Trash2, ShieldCheck, ShieldAlert, Receipt,
  Package, X, Sparkles, Loader2, Wallet, UserPlus,
} from 'lucide-react';
import DocumentUploader from '@/components/common/DocumentUploader';
import { isValidVatFormat, VAT_RATE_DEFAULT } from '@/lib/vatValidation';

const TAX_CLASS_LABEL = { raw_material: 'مادة خام خاضعة (15%)', expense: 'مصروف آخر' };

const emptyInvoice = () => ({
  supplier_id: '', invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10),
  taxable_amount: '', vat_rate: VAT_RATE_DEFAULT, vat_amount: '', tax_classification: 'raw_material',
  document_url: '', notes: '',
});

const emptyLine = () => ({ item_id: '', description: '', quantity: 1, unit_cost: '' });

export default function Purchasing() {
  const session = getSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [form, setForm] = useState(emptyInvoice());
  const [lines, setLines] = useState([emptyLine()]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  // إضافة مورد سريعة من داخل فاتورة الشراء نفسها — بدون فتح صفحة الموردين
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
  const [quickSupplier, setQuickSupplier] = useState({ name: '', vat_number: '', phone: '', address: '' });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'], queryFn: () => db.Supplier.list('name', 200),
  });
  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'], queryFn: () => db.InventoryItem.list('-created_at', 500),
  });
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['purchase-invoices'], queryFn: () => db.PurchaseInvoice.list('-invoice_date', 300),
  });

  // موظف مالي فقط (مالك/مدير/إداري/محاسب) — نفس صلاحيات الفواتير والتقارير المالية
  if (!session?.role || !FINANCE_ROLES.includes(session.role)) return <Navigate to="/pos" replace />;

  const suppliersById = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const itemsById = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
  const selectedSupplier = suppliersById[form.supplier_id];
  const supplierVatOk = selectedSupplier && isValidVatFormat(selectedSupplier.vat_number);

  const linesTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        supplier_id: data.supplier_id,
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        taxable_amount: Number(data.taxable_amount) || 0,
        vat_rate: Number(data.vat_rate) || 0,
        vat_amount: Number(data.vat_amount) || 0,
        tax_classification: data.tax_classification,
        document_url: data.document_url || null,
        notes: data.notes || null,
        supplier_vat_number_snapshot: suppliersById[data.supplier_id]?.vat_number || null,
        vat_number_valid_format: isValidVatFormat(suppliersById[data.supplier_id]?.vat_number),
      };
      const saved = editingInvoice
        ? await db.PurchaseInvoice.update(editingInvoice.id, payload)
        : await db.PurchaseInvoice.create(payload);

      // ربط بنود الفاتورة بالمخزون — نحذف القديم (لو تعديل) ونعيد الإدخال
      if (editingInvoice) {
        const existingLines = await db.PurchaseInvoiceItem.filter({ purchase_invoice_id: editingInvoice.id });
        await Promise.all(existingLines.map(l => db.PurchaseInvoiceItem.delete(l.id)));
      }
      const validLines = lines.filter(l => l.item_id || l.description);
      await Promise.all(validLines.map(l => db.PurchaseInvoiceItem.create({
        purchase_invoice_id: saved.id,
        item_id: l.item_id || null,
        description: l.description || null,
        quantity: Number(l.quantity) || 1,
        unit_cost: Number(l.unit_cost) || 0,
      })));
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success(editingInvoice ? 'تم تحديث فاتورة الشراء' : 'تم إضافة فاتورة الشراء');
      setDialogOpen(false);
      setEditingInvoice(null);
      setForm(emptyInvoice());
      setLines([emptyLine()]);
    },
    onError: (e) => toast.error(`فشل الحفظ: ${e.message || 'خطأ غير معروف — تأكد من تشغيل ملف الهجرة 016_purchasing_tax_module.sql'}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.PurchaseInvoice.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('تم حذف فاتورة الشراء');
    },
  });

  // مورد سريع: يُضاف مباشرة لقائمة الموردين الفعلية (نفس صفحة الموردين)
  // ويُختار تلقائياً بفاتورة الشراء الحالية — بدون مغادرة الشاشة
  const createSupplierQuick = useMutation({
    mutationFn: (data) => db.Supplier.create({
      name: data.name,
      vat_number: data.vat_number || null,
      phone: data.phone || null,
      address: data.address || null,
      is_active: true,
    }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setForm(p => ({ ...p, supplier_id: created.id }));
      setQuickSupplierOpen(false);
      setQuickSupplier({ name: '', vat_number: '', phone: '', address: '' });
      toast.success(
        isValidVatFormat(created.vat_number)
          ? 'تم إضافة المورد بالرقم الضريبي ✅ — واخترناه لك بهذي الفاتورة'
          : 'تم إضافة المورد — لكن بدون رقم ضريبي صالح، فاتورته لن تُقبل بالإقرار حتى تضيفه'
      );
    },
    onError: (e) => toast.error(`تعذّر إضافة المورد: ${e.message || 'خطأ غير معروف'}`),
  });

  const openNew = () => { setEditingInvoice(null); setForm(emptyInvoice()); setLines([emptyLine()]); setDialogOpen(true); };
  const openEdit = async (inv) => {
    setEditingInvoice(inv);
    setForm({
      supplier_id: inv.supplier_id, invoice_number: inv.invoice_number, invoice_date: inv.invoice_date,
      taxable_amount: String(inv.taxable_amount), vat_rate: inv.vat_rate, vat_amount: String(inv.vat_amount),
      tax_classification: inv.tax_classification, document_url: inv.document_url || '', notes: inv.notes || '',
    });
    try {
      const existingLines = await db.PurchaseInvoiceItem.filter({ purchase_invoice_id: inv.id });
      setLines(existingLines.length ? existingLines.map(l => ({ item_id: l.item_id || '', description: l.description || '', quantity: l.quantity, unit_cost: l.unit_cost })) : [emptyLine()]);
    } catch { setLines([emptyLine()]); }
    setDialogOpen(true);
  };

  // إعادة حساب قيمة الضريبة تلقائياً كل ما تغيّر المبلغ الخاضع أو النسبة
  const updateTaxable = (val) => {
    const rate = Number(form.vat_rate) || 0;
    const vat = (Number(val) || 0) * (rate / 100);
    setForm(p => ({ ...p, taxable_amount: val, vat_amount: vat.toFixed(2) }));
  };
  const updateRate = (val) => {
    const vat = (Number(form.taxable_amount) || 0) * (Number(val) / 100);
    setForm(p => ({ ...p, vat_rate: val, vat_amount: vat.toFixed(2) }));
  };

  const runOcr = async (file) => {
    setOcrBusy(true); setOcrProgress(0);
    try {
      const { extractInvoiceFieldsFromImage } = await import('@/lib/invoiceOcr');
      const result = await extractInvoiceFieldsFromImage(file, setOcrProgress);
      if (result.invoiceNumber) setForm(p => ({ ...p, invoice_number: result.invoiceNumber }));
      if (result.date) setForm(p => ({ ...p, invoice_date: normalizeOcrDate(result.date) }));
      if (result.total) updateTaxable(String((result.total / (1 + (Number(form.vat_rate) || 15) / 100)).toFixed(2)));
      toast.success('تمت قراءة الفاتورة — راجع الحقول قبل الحفظ (استخراج تقريبي وليس نهائياً)');
    } catch (err) {
      toast.error('تعذّرت قراءة الصورة تلقائياً، عبّئ الحقول يدوياً');
    } finally {
      setOcrBusy(false);
    }
  };

  const addLine = () => setLines(p => [...p, emptyLine()]);
  const removeLine = (i) => setLines(p => p.filter((_, idx) => idx !== i));
  const updateLine = (i, key, val) => setLines(p => p.map((l, idx) => idx === i ? { ...l, [key]: val } : l));

  const totalInputVat = invoices.reduce((s, i) => s + (Number(i.vat_amount) || 0), 0);
  const invalidCount = invoices.filter(i => !i.vat_number_valid_format).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black">وحدة المشتريات</h1>
            <p className="text-sm text-muted-foreground">تسجيل فواتير الشراء من الموردين وربطها بضريبة المدخلات</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/tax-dashboard">
            <Button variant="outline"><Wallet className="w-4 h-4 ml-1" /> لوحة الضرائب</Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="w-4 h-4 ml-1" /> فاتورة شراء جديدة</Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto max-w-2xl">
              <DialogHeader><DialogTitle>{editingInvoice ? 'تعديل فاتورة الشراء' : 'فاتورة شراء جديدة'}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">

                <div className="space-y-1.5">
                  <Label>مستند الفاتورة</Label>
                  <DocumentUploader value={form.document_url} onChange={v => setForm(p => ({ ...p, document_url: v }))} />
                  {form.document_url && !form.document_url.toLowerCase().includes('.pdf') && (
                    <Button type="button" size="sm" variant="outline" disabled={ocrBusy}
                      onClick={() => fetch(form.document_url).then(r => r.blob()).then(b => runOcr(new File([b], 'invoice.jpg', { type: b.type })))}>
                      {ocrBusy ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 ml-1" />}
                      {ocrBusy ? `قراءة الفاتورة... ${ocrProgress}%` : 'تعبئة تلقائية من الصورة (OCR)'}
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>المورد *</Label>
                    <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
                      onClick={() => setQuickSupplierOpen(o => !o)}>
                      <UserPlus className="w-3.5 h-3.5" /> مورد جديد سريع
                    </Button>
                  </div>
                  {!quickSupplierOpen ? (
                    <>
                      <Select value={form.supplier_id} onValueChange={v => setForm(p => ({ ...p, supplier_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {form.supplier_id && (
                        supplierVatOk ? (
                          <p className="text-[11px] text-green-600 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> رقم ضريبي صالح — تُقبل هذه الفاتورة بالإقرار</p>
                        ) : (
                          <p className="text-[11px] text-red-600 flex items-center gap-1 font-bold">
                            <ShieldAlert className="w-3.5 h-3.5" /> هذا المورد بدون رقم ضريبي صالح — لن تُقبل هذه الفاتورة بالإقرار الضريبي.
                            <Link to="/suppliers" className="underline">أضف الرقم الضريبي أولاً</Link>
                          </p>
                        )
                      )}
                    </>
                  ) : (
                    <div className="space-y-2 border rounded-xl p-3 bg-secondary/30" style={{ borderColor: 'hsl(var(--border))' }}>
                      <p className="text-[11px] text-muted-foreground">
                        عبّي اسم المورد ورقمه الضريبي وخلاص — بيتضاف مباشرة لقائمة الموردين وبيُختار تلقائياً بهذي الفاتورة.
                        باقي بياناته (العنوان، الجوال...) اختيارية وتقدر تكملها لاحقاً من صفحة الموردين.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="اسم المورد *" value={quickSupplier.name}
                          onChange={e => setQuickSupplier(p => ({ ...p, name: e.target.value }))} className="h-9" />
                        <Input placeholder="الرقم الضريبي (15 رقم)" value={quickSupplier.vat_number}
                          onChange={e => setQuickSupplier(p => ({ ...p, vat_number: e.target.value }))} className="h-9" />
                        <Input placeholder="الجوال (اختياري)" value={quickSupplier.phone}
                          onChange={e => setQuickSupplier(p => ({ ...p, phone: e.target.value }))} className="h-9" />
                        <Input placeholder="العنوان (اختياري)" value={quickSupplier.address}
                          onChange={e => setQuickSupplier(p => ({ ...p, address: e.target.value }))} className="h-9" />
                      </div>
                      {quickSupplier.vat_number && !isValidVatFormat(quickSupplier.vat_number) && (
                        <p className="text-[11px] text-amber-600 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> الرقم الضريبي لازم يكون 15 رقم ويبدأ وينتهي بـ 3 — بدونه فاتورة هذا المورد لن تُقبل بالإقرار
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="flex-1" disabled={!quickSupplier.name || createSupplierQuick.isPending}
                          onClick={() => createSupplierQuick.mutate(quickSupplier)}>
                          {createSupplierQuick.isPending ? '...' : 'إضافة واختيار المورد'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setQuickSupplierOpen(false)}>إلغاء</Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>رقم الفاتورة الضريبية *</Label>
                    <Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>تاريخ الفاتورة *</Label>
                    <Input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>التصنيف الضريبي</Label>
                  <Select value={form.tax_classification} onValueChange={v => setForm(p => ({ ...p, tax_classification: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_material">{TAX_CLASS_LABEL.raw_material}</SelectItem>
                      <SelectItem value="expense">{TAX_CLASS_LABEL.expense}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>المبلغ الخاضع للضريبة *</Label>
                    <Input type="number" value={form.taxable_amount} onChange={e => updateTaxable(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>نسبة الضريبة %</Label>
                    <Input type="number" value={form.vat_rate} onChange={e => updateRate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>قيمة الضريبة</Label>
                    <Input type="number" value={form.vat_amount} onChange={e => setForm(p => ({ ...p, vat_amount: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  الإجمالي: {((Number(form.taxable_amount) || 0) + (Number(form.vat_amount) || 0)).toFixed(2)} ر.س
                </p>

                {/* ربط بنود الفاتورة بالمخزون */}
                <div className="space-y-2 border rounded-xl p-3" style={{ borderColor: 'hsl(var(--border))' }}>
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> مواد المخزون المشتراة بهذه الفاتورة</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="w-3.5 h-3.5" /></Button>
                  </div>
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Select value={line.item_id} onValueChange={v => updateLine(i, 'item_id', v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="اختر مادة من المخزون" /></SelectTrigger>
                          <SelectContent>
                            {items.map(it => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input className="col-span-2 h-9" type="number" placeholder="الكمية" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} />
                      <Input className="col-span-3 h-9" type="number" placeholder="سعر الوحدة" value={line.unit_cost} onChange={e => updateLine(i, 'unit_cost', e.target.value)} />
                      <button type="button" onClick={() => removeLine(i)} className="col-span-2 text-red-500 flex justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {linesTotal > 0 && <p className="text-[11px] text-muted-foreground">إجمالي بنود المخزون: {linesTotal.toFixed(2)} ر.س — يفيد كمرجع لتعبئة "المبلغ الخاضع للضريبة" أعلاه</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>ملاحظات</Label>
                  <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="h-16" />
                </div>

                <Button className="w-full" disabled={!form.supplier_id || !form.invoice_number || !form.taxable_amount || saveMutation.isPending}
                  onClick={() => saveMutation.mutate(form)}>
                  {saveMutation.isPending ? '...' : 'حفظ فاتورة الشراء'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ملخص سريع */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">عدد فواتير الشراء</p>
          <p className="text-2xl font-black mt-1">{invoices.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">إجمالي ضريبة المدخلات (قابلة للخصم)</p>
          <p className="text-2xl font-black mt-1 text-green-600">{totalInputVat.toFixed(2)} ر.س</p>
        </CardContent></Card>
        <Card className={invalidCount > 0 ? 'border-red-300' : ''}><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">فواتير برقم ضريبي غير صالح ⚠️</p>
          <p className={`text-2xl font-black mt-1 ${invalidCount > 0 ? 'text-red-600' : ''}`}>{invalidCount}</p>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-bold">ما فيه فواتير شراء مسجّلة بعد</p>
          <p className="text-sm mt-1">اضغط «فاتورة شراء جديدة» عشان تبدأ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <Card key={inv.id} className={!inv.vat_number_valid_format ? 'border-red-300' : ''}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black">{suppliersById[inv.supplier_id]?.name || 'مورد محذوف'}</p>
                    <Badge variant="outline" className="text-[10px]">{TAX_CLASS_LABEL[inv.tax_classification]}</Badge>
                    {!inv.vat_number_valid_format && (
                      <Badge className="bg-red-100 text-red-700 text-[10px] flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> لن تُقبل بالإقرار
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    فاتورة #{inv.invoice_number} — {inv.invoice_date}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">الخاضع للضريبة</p>
                    <p className="font-bold text-sm">{Number(inv.taxable_amount).toFixed(2)} ر.س</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">الضريبة</p>
                    <p className="font-bold text-sm text-green-600">{Number(inv.vat_amount).toFixed(2)} ر.س</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(inv)}>
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
                          <AlertDialogTitle>حذف فاتورة الشراء؟</AlertDialogTitle>
                          <AlertDialogDescription>سيتم حذف الفاتورة #{inv.invoice_number} وبنودها المرتبطة بالمخزون.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(inv.id)} className="bg-red-600 hover:bg-red-700">حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// يحوّل تاريخاً مستخرجاً من OCR (صيغ متعددة) إلى yyyy-mm-dd لحقل input[type=date]
function normalizeOcrDate(raw) {
  const parts = raw.split(/[-/]/).map(s => s.trim());
  if (parts.length !== 3) return new Date().toISOString().slice(0, 10);
  let [a, b, c] = parts;
  if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`; // yyyy-mm-dd
  return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`; // dd-mm-yyyy → yyyy-mm-dd
}
