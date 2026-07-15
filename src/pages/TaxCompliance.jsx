/**
 * TaxCompliance — وحدة إدارة المشتريات والامتثال الضريبي
 * ─────────────────────────────────────────────────────────────
 * تبويب 1: فواتير المشتريات (ضريبة المدخلات) — تسجيل فواتير الموردين
 *          مع رقم الفاتورة الضريبي، المبلغ، الضريبة، التصنيف، وأرشفة
 *          صورة/PDF الفاتورة (مطلب نظامي بالاحتفاظ بالسجلات).
 * تبويب 2: الموازنة الضريبية — ضريبة المبيعات (مخرجات) ناقص ضريبة
 *          المشتريات (مدخلات) = صافي الضريبة المستحقة للهيئة، مع
 *          إمكانية تصدير تقرير جاهز للإقرار الضريبي.
 *
 * ملاحظة مهمة: التحقق من الرقم الضريبي هنا هو تحقق من "صحة الصيغة"
 * فقط (15 رقم، يبدأ وينتهي بـ 3) — وليس تحقق حي من سيرفرات زاتكا
 * الحكومية (يحتاج ربط API رسمي منفصل). أي فاتورة بدون رقم ضريبي
 * صحيح الصيغة تُنبَّه بوضوح لأنها لن تُقبل بالإقرار.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { base44, storage } from '@/api/supabaseApi';
import { getSession } from '@/lib/sessionStore';
import { isFinanceUser } from '@/lib/roles';
import { validateVATNumber } from '@/lib/zatca/zatcaUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { FileText, Upload, Plus, Trash2, AlertTriangle, CheckCircle2, Receipt, Scale, Download, Loader2, Paperclip } from 'lucide-react';
import jsPDF from 'jspdf';

const TAX_CATEGORY_LABELS = {
  standard_15: 'خاضع 15%',
  zero_rated: 'صفري (0%)',
  exempt: 'معفى',
  other: 'أخرى / غير خاضع',
};

const EMPTY_FORM = {
  supplier_id: '', invoice_number: '', invoice_date: format(new Date(), 'yyyy-MM-dd'),
  tax_category: 'standard_15', subtotal: '', document_url: '', notes: '',
};

export default function TaxCompliance() {
  const session = getSession();
  if (!isFinanceUser(session?.role)) return <Navigate to="/pos" replace />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black flex items-center gap-2"><Scale className="w-5 h-5" /> الامتثال الضريبي والمشتريات</h1>
        <p className="text-sm text-muted-foreground mt-1">تسجيل فواتير المشتريات، وحساب صافي الضريبة المستحقة أو المستردة</p>
      </div>

      <Tabs defaultValue="purchases" dir="rtl">
        <TabsList>
          <TabsTrigger value="purchases"><Receipt className="w-4 h-4 ml-1.5" />فواتير المشتريات</TabsTrigger>
          <TabsTrigger value="dashboard"><Scale className="w-4 h-4 ml-1.5" />الموازنة الضريبية</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="mt-4">
          <PurchaseInvoicesTab session={session} />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <TaxDashboardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// تبويب فواتير المشتريات
// ────────────────────────────────────────────────────────────────
function PurchaseInvoicesTab({ session }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list('name', 200),
  });
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['purchase-invoices'], queryFn: () => base44.entities.PurchaseInvoice.list('-invoice_date', 300),
  });

  const supplier = suppliers.find(s => s.id === form.subtotal_supplier_id || s.id === form.supplier_id);
  const supplierVatIssue = form.supplier_id && supplier && supplier.vat_number && !validateVATNumber(supplier.vat_number);
  const supplierVatMissing = form.supplier_id && supplier && !supplier.vat_number;

  const subtotalNum = parseFloat(form.subtotal) || 0;
  const vatAmount = form.tax_category === 'standard_15' ? +(subtotalNum * 0.15).toFixed(2) : 0;
  const total = +(subtotalNum + vatAmount).toFixed(2);

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!form.invoice_number.trim()) throw new Error('رقم الفاتورة الضريبية مطلوب');
      if (!form.supplier_id) throw new Error('اختر المورد أولاً');
      if (!subtotalNum) throw new Error('المبلغ الخاضع للضريبة مطلوب');
      const sup = suppliers.find(s => s.id === form.supplier_id);
      return base44.entities.PurchaseInvoice.create({
        supplier_id: form.supplier_id,
        supplier_name: sup?.name || '',
        supplier_vat_number: sup?.vat_number || '',
        invoice_number: form.invoice_number.trim(),
        invoice_date: form.invoice_date,
        tax_category: form.tax_category,
        subtotal: subtotalNum, vat_amount: vatAmount, total,
        document_url: form.document_url,
        notes: form.notes,
        branch_id: session?.branch_id || null,
        created_by_name: session?.name || '',
        month_key: format(new Date(form.invoice_date), 'yyyy-MM'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('تم تسجيل فاتورة الشراء');
      setForm(EMPTY_FORM);
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: (inv) => base44.entities.PurchaseInvoice.delete(inv.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('تم حذف الفاتورة');
    },
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await storage.uploadFile({ file, bucket: 'purchase-documents' });
      setForm(f => ({ ...f, document_url: file_url }));
      toast.success('تم رفع المستند');
    } catch (err) {
      toast.error('فشل رفع المستند: ' + (err.message || ''));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const missingVatCount = invoices.filter(i => !i.supplier_vat_number || !validateVATNumber(i.supplier_vat_number)).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="lg:col-span-1 h-fit">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" />فاتورة شراء جديدة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>المورد</Label>
            <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {supplierVatMissing && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5" /> هذا المورد بدون رقم ضريبي — الفاتورة لن تُقبل بالإقرار
              </p>
            )}
            {supplierVatIssue && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5" /> صيغة الرقم الضريبي لهذا المورد غير صحيحة
              </p>
            )}
          </div>

          <div>
            <Label>رقم الفاتورة الضريبية</Label>
            <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="مثال: INV-2026-00451" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>تاريخ الفاتورة</Label>
              <Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
            </div>
            <div>
              <Label>التصنيف الضريبي</Label>
              <Select value={form.tax_category} onValueChange={v => setForm(f => ({ ...f, tax_category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TAX_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>المبلغ الخاضع للضريبة (ر.س)</Label>
            <Input type="number" step="0.01" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">قيمة الضريبة المستحقة</span><span className="font-bold">{vatAmount.toFixed(2)} ر.س</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">الإجمالي</span><span className="font-bold">{total.toFixed(2)} ر.س</span></div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" />أرشفة صورة/PDF الفاتورة</Label>
            <div className="flex items-center gap-2 mt-1">
              <label className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md border border-dashed text-sm cursor-pointer hover:bg-muted transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {form.document_url ? 'تم الرفع ✓ — تغيير الملف' : 'رفع صورة أو PDF'}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">مطلوب نظامياً للاحتفاظ بالسجلات (عدة سنوات) وقت أي مراجعة من الهيئة</p>
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-16" />
          </div>

          <Button className="w-full" disabled={createInvoice.isPending} onClick={() => createInvoice.mutate()}>
            {createInvoice.isPending ? 'جاري الحفظ...' : 'حفظ فاتورة الشراء'}
          </Button>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-3">
        {missingVatCount > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            عندك {missingVatCount} فاتورة بدون رقم ضريبي صحيح — لن تُقبل هذي الفواتير ضمن الإقرار الضريبي
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : invoices.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">ما فيه فواتير مشتريات مسجّلة بعد</CardContent></Card>
        ) : (
          invoices.map(inv => {
            const vatOk = inv.supplier_vat_number && validateVATNumber(inv.supplier_vat_number);
            return (
              <Card key={inv.id}>
                <CardContent className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{inv.supplier_name}</span>
                      <Badge variant="outline" className="text-[10px]">{inv.invoice_number}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TAX_CATEGORY_LABELS[inv.tax_category]}</Badge>
                      {vatOk
                        ? <Badge className="text-[10px] bg-green-500/10 text-green-700 border-green-500/20 gap-1"><CheckCircle2 className="w-3 h-3" />رقم ضريبي صحيح</Badge>
                        : <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 gap-1"><AlertTriangle className="w-3 h-3" />بدون رقم ضريبي صالح</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(inv.invoice_date), 'dd/MM/yyyy')} · المبلغ: {inv.subtotal?.toFixed(2)} ر.س · الضريبة: {inv.vat_amount?.toFixed(2)} ر.س · الإجمالي: {inv.total?.toFixed(2)} ر.س
                    </p>
                    {inv.document_url && (
                      <a href={inv.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1 w-fit">
                        <FileText className="w-3 h-3" /> عرض المستند المؤرشف
                      </a>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف فاتورة الشراء {inv.invoice_number}؟</AlertDialogTitle>
                        <AlertDialogDescription>هذا الإجراء نهائي ولا يمكن التراجع عنه.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteInvoice.mutate(inv)}>نعم، احذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// تبويب الموازنة الضريبية
// ────────────────────────────────────────────────────────────────
function TaxDashboardTab() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const monthDate = new Date(`${month}-01T00:00:00`);
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);

  const { data: orders = [] } = useQuery({
    queryKey: ['tax-orders', month],
    queryFn: () => base44.entities.Order.list('-created_at', 2000, 'vat_amount, created_at'),
  });
  const { data: salesInvoices = [] } = useQuery({
    queryKey: ['tax-sales-invoices', month],
    queryFn: () => base44.entities.SalesInvoice.list('-created_at', 2000, 'vat_amount, created_at'),
  });
  const { data: purchaseInvoices = [] } = useQuery({
    queryKey: ['tax-purchase-invoices', month],
    queryFn: () => base44.entities.PurchaseInvoice.list('-invoice_date', 2000),
  });

  const inRange = (dateStr) => {
    const d = new Date(dateStr);
    return d >= start && d <= end;
  };

  const outputTaxOrders = orders.filter(o => inRange(o.created_at)).reduce((s, o) => s + (Number(o.vat_amount) || 0), 0);
  const outputTaxSales = salesInvoices.filter(s => inRange(s.created_at)).reduce((s, i) => s + (Number(i.vat_amount) || 0), 0);
  const outputTax = +(outputTaxOrders + outputTaxSales).toFixed(2);

  const monthPurchases = purchaseInvoices.filter(p => p.month_key === month);
  const inputTax = +monthPurchases.reduce((s, p) => s + (Number(p.vat_amount) || 0), 0).toFixed(2);
  const totalPurchasesSubtotal = +monthPurchases.reduce((s, p) => s + (Number(p.subtotal) || 0), 0).toFixed(2);

  const netPayable = +(outputTax - inputTax).toFixed(2);

  const exportDeclarationPDF = () => {
    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('تقرير الإقرار الضريبي (VAT Return Summary)', 105, 20, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`الفترة: ${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`, 105, 30, { align: 'center' });

    const rows = [
      ['ضريبة المخرجات (المبيعات)', `${outputTax.toFixed(2)} SAR`],
      ['ضريبة المدخلات (المشتريات)', `${inputTax.toFixed(2)} SAR`],
      ['إجمالي المشتريات الخاضعة (بدون ضريبة)', `${totalPurchasesSubtotal.toFixed(2)} SAR`],
      ['عدد فواتير المشتريات المسجّلة', `${monthPurchases.length}`],
      ['صافي الضريبة المستحقة (+) / المستردة (-)', `${netPayable.toFixed(2)} SAR`],
    ];
    let y = 45;
    rows.forEach(([label, value]) => {
      pdf.text(label, 190, y, { align: 'right' });
      pdf.text(value, 20, y);
      y += 10;
    });

    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text('ملاحظة: هذا ملخص مساعد لإعداد الإقرار، وليس بديلاً عن التقديم الرسمي بموقع هيئة الزكاة والضريبة والجمارك (فوترة).', 190, y + 10, { align: 'right', maxWidth: 170 });

    pdf.save(`تقرير-الإقرار-الضريبي-${month}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="whitespace-nowrap">الشهر</Label>
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48" />
        <Button variant="outline" onClick={exportDeclarationPDF} className="gap-2">
          <Download className="w-4 h-4" /> تصدير تقرير الإقرار (PDF)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-5">
            <p className="text-xs text-muted-foreground mb-1">ضريبة المخرجات (المبيعات)</p>
            <p className="text-2xl font-black text-green-600">{outputTax.toFixed(2)} ر.س</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs text-muted-foreground mb-1">ضريبة المدخلات (المشتريات)</p>
            <p className="text-2xl font-black text-blue-600">{inputTax.toFixed(2)} ر.س</p>
          </CardContent>
        </Card>
        <Card className={netPayable >= 0 ? 'border-orange-300' : 'border-green-300'}>
          <CardContent className="py-5">
            <p className="text-xs text-muted-foreground mb-1">{netPayable >= 0 ? 'صافي الضريبة المستحقة' : 'صافي الضريبة المستردة'}</p>
            <p className={`text-2xl font-black ${netPayable >= 0 ? 'text-orange-600' : 'text-green-600'}`}>{Math.abs(netPayable).toFixed(2)} ر.س</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">تفاصيل الحساب</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">إجمالي المشتريات الخاضعة (بدون ضريبة)</span><span className="font-bold">{totalPurchasesSubtotal.toFixed(2)} ر.س</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">عدد فواتير المشتريات هذا الشهر</span><span className="font-bold">{monthPurchases.length}</span></div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="text-muted-foreground">المعادلة</span>
            <span className="font-mono text-xs">{outputTax.toFixed(2)} − {inputTax.toFixed(2)} = {netPayable.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
