/**
 * TaxDashboard — لوحة تحكم الضرائب
 * ─────────────────────────────────────────────────────────────
 * الموازنة الضريبية: ضريبة المبيعات (المخرجات) − ضريبة المشتريات
 * (المدخلات) = صافي الضريبة المستحقة للهيئة.
 * زر "تصدير الإقرار الضريبي" ينشئ ملف إكسل جاهز للتقديم، فيه
 * جدول مخصص للمشتريات وضريبة المدخلات مع علامة "مقبولة بالإقرار؟"
 * لكل فاتورة حسب صلاحية الرقم الضريبي للمورد.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/sessionStore';
import { isFinanceUser } from '@/lib/roles';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, TrendingDown, Scale, FileSpreadsheet, ShieldAlert,
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

  const [start, end] = range;

  const load = async () => {
    setLoading(true);
    const startISO = start.toISOString();
    const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();
    const startDay = format(start, 'yyyy-MM-dd');
    const endDay = format(end, 'yyyy-MM-dd');

    const [{ data: o }, { data: s }, { data: p }, { data: ex }, { data: sup }] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('sales_invoices').select('*').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('purchase_invoices').select('*').gte('invoice_date', startDay).lte('invoice_date', endDay),
      supabase.from('expenses').select('*').eq('is_vat_applicable', true).gte('expense_date', startDay).lte('expense_date', endDay),
      supabase.from('suppliers').select('id,name'),
    ]);
    setOrders(o || []); setSales(s || []); setPurchases(p || []); setExpenses(ex || []);
    setSuppliersById(Object.fromEntries((sup || []).map(x => [x.id, x.name])));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  const applyPreset = (key) => { setPreset(key); setRange(PRESETS[key]()); };

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
          <Button onClick={exportReturn} disabled={exporting}>
            <FileSpreadsheet className="w-4 h-4 ml-1" /> {exporting ? 'جارِ الإنشاء...' : 'تصدير الإقرار الضريبي'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.keys(PRESETS).map(key => (
          <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'} onClick={() => applyPreset(key)}>
            {PRESET_LABELS[key]}
          </Button>
        ))}
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
        </>
      )}
    </div>
  );
}
