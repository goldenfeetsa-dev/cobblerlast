/**
 * TaxDashboard — لوحة تحكم الضرائب
 * ─────────────────────────────────────────────────────────────
 * الموازنة الضريبية: ضريبة المبيعات (المخرجات) − ضريبة المشتريات
 * (المدخلات) = صافي الضريبة المستحقة للهيئة.
 * زر "تصدير الإقرار الضريبي" ينشئ ملف إكسل جاهز للتقديم، فيه
 * جدول مخصص للمشتريات وضريبة المدخلات مع علامة "مقبولة بالإقرار؟"
 * لكل فاتورة حسب صلاحية الرقم الضريبي للمورد.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/sessionStore';
import { isFinanceUser } from '@/lib/roles';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Wallet, TrendingUp, TrendingDown, Scale, FileSpreadsheet, FileDown, ShieldAlert,
  ShoppingBag, RefreshCw,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, startOfQuarter } from 'date-fns';

const fmt = (n) => (Number(n) || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRESETS = {
  thisMonth: () => [startOfMonth(new Date()), endOfMonth(new Date())],
  lastMonth: () => { const d = subMonths(new Date(), 1); return [startOfMonth(d), endOfMonth(d)]; },
  thisQuarter: () => [startOfQuarter(new Date()), endOfMonth(new Date())],
  thisYear: () => [startOfYear(new Date()), endOfMonth(new Date())],
};
const PRESET_LABELS = { thisMonth: 'هذا الشهر', lastMonth: 'الشهر الماضي', thisQuarter: 'هذا الربع', thisYear: 'هذي السنة' };

export default function TaxDashboard() {
  const session = getSession();
  const [preset, setPreset] = useState('thisMonth');
  const [range, setRange] = useState(PRESETS.thisMonth());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [suppliersById, setSuppliersById] = useState({});
  const [zatcaSettings, setZatcaSettings] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const statementRef = useRef(null);

  const [start, end] = range;

  const load = async () => {
    setLoading(true);
    const startISO = start.toISOString();
    const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();
    const startDay = format(start, 'yyyy-MM-dd');
    const endDay = format(end, 'yyyy-MM-dd');

    const [{ data: o }, { data: s }, { data: p }, { data: ex }, { data: sup }, { data: zs }] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('sales_invoices').select('*').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('purchase_invoices').select('*').gte('invoice_date', startDay).lte('invoice_date', endDay),
      supabase.from('expenses').select('*').eq('is_vat_applicable', true).gte('expense_date', startDay).lte('expense_date', endDay),
      supabase.from('suppliers').select('id,name'),
      supabase.from('zatca_settings').select('*').eq('id', 1).single(),
    ]);
    setOrders(o || []); setSales(s || []); setPurchases(p || []); setExpenses(ex || []);
    setSuppliersById(Object.fromEntries((sup || []).map(x => [x.id, x.name])));
    setZatcaSettings(zs || null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  const applyPreset = (key) => { setPreset(key); setRange(PRESETS[key]()); };

  // تحديد فترة يدوياً (من - إلى) بدل الاكتفاء بالفترات الجاهزة فقط
  const setCustomStart = (val) => {
    if (!val) return;
    setPreset('custom');
    setRange([new Date(val + 'T00:00:00'), end]);
  };
  const setCustomEnd = (val) => {
    if (!val) return;
    setPreset('custom');
    setRange([start, new Date(val + 'T00:00:00')]);
  };

  if (!session?.role || !isFinanceUser(session.role)) return <Navigate to="/pos" replace />;

  // ── ضريبة المخرجات (المبيعات) — فقط المُبلَّغة فعلياً لزاتكا ──
  const reportedOrders = orders.filter(o => o.zatca_status === 'REPORTED');
  const reportedSales = sales.filter(s => s.zatca_status === 'REPORTED');
  const unreportedCount = (orders.length + sales.length) - (reportedOrders.length + reportedSales.length);
  const vatCollected = useMemo(() => [...reportedOrders, ...reportedSales].reduce((s, r) => {
    const sub = r.subtotal ?? (r.total_price ? r.total_price / 1.15 : 0);
    return s + sub * 0.15;
  }, 0), [orders, sales]);

  // ── ضريبة المدخلات (المشتريات) — فقط الفواتير بمورد له رقم ضريبي صالح ──
  const validPurchases = purchases.filter(p => p.vat_number_valid_format);
  const invalidPurchases = purchases.filter(p => !p.vat_number_valid_format);
  const vatPaidPurchases = validPurchases.reduce((s, p) => s + (Number(p.vat_amount) || 0), 0);
  const vatPaidExcluded = invalidPurchases.reduce((s, p) => s + (Number(p.vat_amount) || 0), 0);

  // ── ضريبة المصروفات القابلة للخصم (إيجار، كهرباء... مصروفات شاملة ضريبة) ──
  const vatPaidExpenses = expenses.reduce((s, e) => s + (Number(e.vat_amount) || 0), 0);

  const vatPaidDeductible = vatPaidPurchases + vatPaidExpenses;
  const netVatDue = vatCollected - vatPaidDeductible;

  const exportReturn = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: start.toISOString(), end: end.toISOString() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'فشل التصدير'); }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('spreadsheetml') && !contentType.includes('application/vnd.openxmlformats')) {
        throw new Error('الخادم رجّع رد غير متوقع — تأكد إن دالة /api/reports/export-excel شغالة على الاستضافة');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `إقرار-ضريبي-${format(start, 'yyyy-MM-dd')}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success('تم إنشاء ملف الإقرار الضريبي');
    } catch (err) { toast.error(err.message); } finally { setExporting(false); }
  };

  // ── تصدير الإقرار كـ PDF احترافي: نفس تقنية "كشف الحساب" (تصوير
  // القالب المخفي بالمتصفح ثم تركيبه بملف PDF) — يضمن ظهور الشعار
  // والخط العربي بشكل مثالي، بدون أي عبارات تحذير/أخطاء داخل المستند
  // الرسمي نفسه (تلك تبقى بالشاشة فقط للمتابعة الداخلية). ──
  const exportPDF = async () => {
    if (!statementRef.current) return;
    setExportingPdf(true);
    try {
      const canvas = await html2canvas(statementRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210, pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight, position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`إقرار-ضريبي-${format(start, 'yyyy-MM-dd')}-${format(end, 'yyyy-MM-dd')}.pdf`);
      toast.success('تم إنشاء ملف PDF للإقرار الضريبي');
    } catch (err) {
      toast.error('تعذّر إنشاء ملف PDF: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black">لوحة تحكم الضرائب</h1>
            <p className="text-sm text-muted-foreground">الموازنة بين ضريبة المبيعات وضريبة المشتريات لحساب صافي المستحق للهيئة</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Link to="/purchasing"><Button variant="outline"><ShoppingBag className="w-4 h-4 ml-1" /> وحدة المشتريات</Button></Link>
          <Button onClick={load} variant="ghost" size="icon"><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={exportReturn} disabled={exporting} variant="outline">
            <FileSpreadsheet className="w-4 h-4 ml-1" /> {exporting ? 'جارِ الإنشاء...' : 'Excel'}
          </Button>
          <Button onClick={exportPDF} disabled={exportingPdf || loading}>
            <FileDown className="w-4 h-4 ml-1" /> {exportingPdf ? 'جارِ الإنشاء...' : 'تصدير الإقرار PDF'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {Object.keys(PRESETS).map(key => (
          <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'} onClick={() => applyPreset(key)}>
            {PRESET_LABELS[key]}
          </Button>
        ))}
        <div className="flex items-center gap-2 border-r pr-3 mr-1" style={{ borderColor: 'hsl(var(--border))' }}>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="tax-from" className="text-xs text-muted-foreground shrink-0">من</Label>
            <Input id="tax-from" type="date" className="h-8 w-[150px] text-xs"
              value={format(start, 'yyyy-MM-dd')} onChange={e => setCustomStart(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="tax-to" className="text-xs text-muted-foreground shrink-0">إلى</Label>
            <Input id="tax-to" type="date" className="h-8 w-[150px] text-xs"
              value={format(end, 'yyyy-MM-dd')} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {unreportedCount > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              فيه {unreportedCount} فاتورة/طلب مبيعات لسه ما انبلّغ لزاتكا بهذي الفترة — مو محسوبة ضمن ضريبة المخرجات هنا.
            </div>
          )}
          {invalidPurchases.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              فيه {invalidPurchases.length} فاتورة شراء بمبلغ ضريبة {fmt(vatPaidExcluded)} ر.س مستبعدة من الخصم لأن موردها بدون رقم ضريبي صالح —
              <Link to="/suppliers" className="underline font-bold">حدّث بيانات الموردين</Link>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-700"><TrendingUp className="w-4 h-4" /><p className="text-xs font-bold">ضريبة المخرجات (المبيعات)</p></div>
                <p className="text-2xl font-black mt-2 text-green-700">{fmt(vatCollected)} ر.س</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-700"><TrendingDown className="w-4 h-4" /><p className="text-xs font-bold">ضريبة المدخلات القابلة للخصم (المشتريات)</p></div>
                <p className="text-2xl font-black mt-2 text-blue-700">{fmt(vatPaidDeductible)} ر.س</p>
              </CardContent>
            </Card>
            <Card className={netVatDue >= 0 ? 'border-primary/30' : 'border-green-300'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2"><Scale className="w-4 h-4" /><p className="text-xs font-bold">صافي الضريبة المستحقة للهيئة</p></div>
                <p className={`text-2xl font-black mt-2 ${netVatDue >= 0 ? '' : 'text-green-600'}`}>{fmt(Math.abs(netVatDue))} ر.س</p>
                <p className="text-[11px] text-muted-foreground mt-1">{netVatDue >= 0 ? 'مبلغ يجب سداده للهيئة' : 'رصيد ضريبي لصالحك (استرداد/ترحيل)'}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">فواتير الشراء بهذي الفترة</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">ما فيه فواتير شراء بهذي الفترة</p>
              ) : purchases.map(p => (
                <div key={p.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                  <div>
                    <p className="font-bold">{suppliersById[p.supplier_id] || 'مورد محذوف'} — #{p.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{p.invoice_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs">ضريبة: {fmt(p.vat_amount)} ر.س</span>
                    {p.vat_number_valid_format ? (
                      <Badge className="bg-green-100 text-green-700 text-[10px]">قابلة للخصم</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 text-[10px]">غير مقبولة</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ═══ قالب الإقرار القابل للطباعة/التصدير PDF ═══
              هذا هو المستند الرسمي فقط: شعار + بيانات المنشأة + الأقسام
              الثلاثة + جدول المشتريات — بدون أي عبارات تحذير/أخطاء
              داخلية (تلك تظهر فوق بالشاشة فقط ولا تُطبع بالمستند). */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">معاينة الإقرار القابل للتصدير PDF</CardTitle></CardHeader>
            <CardContent>
              <div ref={statementRef} className="bg-white text-black p-8 rounded-lg" dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                <div className="flex items-center justify-between border-b-2 pb-4 mb-5" style={{ borderColor: '#6b4226' }}>
                  <div className="flex items-center gap-3">
                    <img src="/images/logo-cobblers.png" alt="الشعار" className="w-14 h-14 rounded-lg object-contain" style={{ background: '#6b4226' }} />
                    <div>
                      <h2 className="text-lg font-black" style={{ color: '#4a2e18' }}>{zatcaSettings?.seller_name || 'إبرة وخيط الإسكافي'}</h2>
                      <p className="text-xs text-gray-500">إقرار ضريبة القيمة المضافة (VAT Return)</p>
                    </div>
                  </div>
                  <div className="text-left text-xs text-gray-500">
                    <p>الفترة: {format(start, 'yyyy-MM-dd')} — {format(end, 'yyyy-MM-dd')}</p>
                    <p>تاريخ الإعداد: {format(new Date(), 'yyyy-MM-dd')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div className="p-3 rounded-lg" style={{ background: '#fbf6ee' }}>
                    <p className="text-[11px] text-gray-500">الرقم الضريبي (VAT)</p>
                    <p className="font-bold" style={{ color: zatcaSettings?.vat_number ? '#000' : '#b5442e' }}>
                      {zatcaSettings?.vat_number || 'غير مضبوط بإعدادات زاتكا — يُرجى إدخاله قبل التقديم الرسمي'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: '#fbf6ee' }}>
                    <p className="text-[11px] text-gray-500">السجل التجاري (C.R)</p>
                    <p className="font-bold">{zatcaSettings?.cr_number || '—'}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-white text-xs font-bold px-3 py-1.5 rounded-t-md" style={{ background: '#16a34a' }}>القسم الأول — ضريبة المخرجات (المبيعات)</div>
                  <div className="border border-t-0 rounded-b-md p-3 text-sm space-y-1.5">
                    <div className="flex justify-between"><span>المبيعات الخاضعة للنسبة الأساسية (15%) — صافي المبلغ</span><span className="font-mono font-bold">{fmt(vatCollected / 0.15)}</span></div>
                    <div className="flex justify-between"><span>ضريبة القيمة المضافة المستحقة على المبيعات</span><span className="font-mono font-bold">{fmt(vatCollected)}</span></div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-white text-xs font-bold px-3 py-1.5 rounded-t-md" style={{ background: '#2563eb' }}>القسم الثاني — ضريبة المدخلات (المشتريات)</div>
                  <div className="border border-t-0 rounded-b-md p-3 text-sm space-y-1.5">
                    <div className="flex justify-between"><span>ضريبة فواتير المشتريات القابلة للخصم</span><span className="font-mono font-bold">{fmt(vatPaidPurchases)}</span></div>
                    <div className="flex justify-between"><span>ضريبة المصروفات المسجّلة الشاملة للضريبة</span><span className="font-mono font-bold">{fmt(vatPaidExpenses)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1.5"><span>الإجمالي القابل للخصم</span><span className="font-mono">{fmt(vatPaidDeductible)}</span></div>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-white text-xs font-bold px-3 py-1.5 rounded-t-md" style={{ background: '#1e3a8a' }}>القسم الثالث — الصافي</div>
                  <div className="border border-t-0 rounded-b-md p-4 flex justify-between items-center">
                    <span className="font-bold text-sm">{netVatDue >= 0 ? 'صافي الضريبة المستحقة (تُسدَّد للهيئة)' : 'صافي الرصيد الضريبي لصالحك'}</span>
                    <span className="font-mono font-black text-lg" style={{ color: netVatDue >= 0 ? '#dc2626' : '#16a34a' }}>{fmt(Math.abs(netVatDue))} ر.س</span>
                  </div>
                </div>

                {purchases.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-500 mb-2">تفاصيل فواتير المشتريات القابلة للخصم</p>
                    <table className="w-full text-xs">
                      <thead><tr className="border-b text-gray-500"><th className="text-right py-1.5">التاريخ</th><th className="text-right py-1.5">المورد</th><th className="text-right py-1.5">رقم الفاتورة</th><th className="text-left py-1.5">قيمة الضريبة</th></tr></thead>
                      <tbody>
                        {purchases.filter(p => p.vat_number_valid_format).map(p => (
                          <tr key={p.id} className="border-b border-gray-100">
                            <td className="py-1 text-gray-500">{p.invoice_date}</td>
                            <td className="py-1">{suppliersById[p.supplier_id] || '—'}</td>
                            <td className="py-1">{p.invoice_number}</td>
                            <td className="py-1 text-left font-mono">{fmt(p.vat_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-[10px] text-gray-400 border-t pt-3 mt-4">
                  هذا الملف مُعِد للمساعدة في تعبئة الإقرار عبر بوابة فاتورة (fatoora.zatca.gov.sa) — يُرجى مراجعة الأرقام مع محاسبكم القانوني قبل التقديم الرسمي.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
