/**
 * FinancialReports.jsx — التقارير المالية / كشف الحساب
 * ──────────────────────────────────────────────────────────────────
 * أرقام حقيقية فقط:
 *  • الإيراد = مجموع (طلبات الإصلاح + فواتير المبيعات) الفعلية بالفترة
 *  • المصاريف = مصاريف يدوية مصنّفة (إيجار/رواتب/...) + تكلفة مواد الورشة
 *    (تُفضَّل أرقام التسوية الشهرية المُصادَق عليها من WorkshopSystem إذا
 *     كان الشهر مُسوّى، وإلا تُستخدم مسحوبات العهدة الخام كتقدير — بنفس
 *     المصطلح "تقديري" المستخدم بصفحة الورشة نفسها لتفادي تناقض الأرقام)
 *  • الضرائب = ضريبة القيمة المضافة من فواتير أُبلِغت فعلياً لزاتكا
 *    (zatca_status = REPORTED) فقط — رقم يُعتمد عليه فعلياً لإقرار ضريبي
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { db } from '@/api/supabaseApi';
import { secureExpenses } from '@/lib/secureApi';
import { getSession } from '@/lib/sessionStore';
import { isFinanceUser } from '@/lib/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Receipt, FileDown, FileSpreadsheet,
  Plus, Shield, Calendar, RefreshCw,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, startOfQuarter } from 'date-fns';

const EXPENSE_CATEGORIES = {
  rent: 'إيجار', salaries: 'رواتب', utilities: 'فواتير خدمات',
  supplies: 'مستلزمات', maintenance: 'صيانة', marketing: 'تسويق', other: 'أخرى',
};
const CHART_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#64748b'];
const fmt = (n) => (Number(n) || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthKeyOf(d) { return format(d, 'yyyy-MM'); }

const PRESETS = {
  thisMonth: () => [startOfMonth(new Date()), endOfMonth(new Date())],
  lastMonth: () => { const d = subMonths(new Date(), 1); return [startOfMonth(d), endOfMonth(d)]; },
  thisQuarter: () => [startOfQuarter(new Date()), endOfMonth(new Date())],
  thisYear: () => [startOfYear(new Date()), endOfMonth(new Date())],
};

export default function FinancialReports() {
  const session = getSession();
  const isAdmin = isFinanceUser(session?.role);

  const [range, setRange] = useState(PRESETS.thisMonth());
  const [preset, setPreset] = useState('thisMonth');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [custodies, setCustodies] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [trend, setTrend] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [receivable, setReceivable] = useState(0);
  const [payable, setPayable] = useState(0);
  const [newExpense, setNewExpense] = useState({ category: 'other', description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'), has_vat: false, has_tax_invoice: false, supplier_vat_number: '' });
  const [exporting, setExporting] = useState(false);
  const statementRef = useRef(null);

  const [start, end] = range;

  const load = async () => {
    setLoading(true);
    const startISO = start.toISOString();
    const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();
    const startDay = format(start, 'yyyy-MM-dd');
    const endDay = format(end, 'yyyy-MM-dd');

    const [{ data: o }, { data: s }, expensesData, { data: c }, { data: st }, { data: notes }, { data: unpaidOrders }, { data: unpaidSales }, { data: payables }] = await Promise.all([
      supabase.from('orders').select('subtotal,total_price,zatca_status,created_at,order_number,customer_name,status').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('sales_invoices').select('subtotal,zatca_status,created_at,invoice_number').gte('created_at', startISO).lte('created_at', endISO),
      secureExpenses.list({ orderBy: '-expense_date', limit: 2000, gteCol: 'expense_date', gteVal: startDay, lteCol: 'expense_date', lteVal: endDay }),
      supabase.from('workshop_custodies').select('total_cost,month_key').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('workshop_settlements').select('month_key,total_workshop_cost'),
      supabase.from('zatca_credit_debit_notes').select('note_type,amount,vat_amount,created_at').gte('created_at', startISO).lte('created_at', endISO).eq('zatca_status', 'REPORTED'),
      // "كم لي" — مستحقات على العملاء (غير محصورة بفترة، رقم لحظي)
      supabase.from('orders').select('total_price').eq('payment_status', 'unpaid').not('status', 'in', '(cancelled,returned)'),
      supabase.from('sales_invoices').select('total').eq('payment_status', 'unpaid'),
      // "كم علي" — مستحقات للموردين
      supabase.from('purchase_invoices').select('taxable_amount,vat_amount,amount_paid').neq('payment_status', 'paid'),
    ]);
    setOrders(o || []); setSales(s || []); setExpenses(expensesData || []); setCustodies(c || []); setSettlements(st || []);
    setCreditNotes(notes || []);
    const receivable = (unpaidOrders || []).reduce((sum, r) => sum + (r.total_price || 0), 0)
      + (unpaidSales || []).reduce((sum, r) => sum + (r.total || 0), 0);
    const payable = (payables || []).reduce((sum, r) => sum + ((r.taxable_amount || 0) + (r.vat_amount || 0) - (r.amount_paid || 0)), 0);
    setReceivable(receivable);
    setPayable(payable);

    // آخر 6 أشهر للرسم البياني — استعلام واحد مجمّع بقاعدة البيانات
    // بدل 18 استعلام منفصل (كان السبب الرئيسي لبطء الصفحة)
    const { data: trendRaw, error: trendErr } = await supabase.rpc('get_monthly_financial_trend', { months_count: 6 });
    if (trendErr) {
      console.error('trend rpc error', trendErr);
      setTrend([]);
    } else {
      const trendRows = (trendRaw || []).map((row) => {
        const settlement = (st || []).find((x) => x.month_key === row.month_key);
        const materialCost = settlement ? (settlement.total_workshop_cost || 0) : 0;
        return {
          month: format(new Date(`${row.month_key}-01`), 'MM/yyyy'),
          الإيراد: Math.round(row.revenue || 0),
          المصاريف: Math.round((row.manual_expenses || 0) + materialCost),
        };
      });
      setTrend(trendRows);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  const applyPreset = (key) => {
    setPreset(key);
    setRange(PRESETS[key]());
  };

  // ── الحسابات الحقيقية للفترة المختارة ────────────────────────────
  // الطلبات الملغاة/المُسترجعة لا تُحتسب إيراد فعلي أبداً
  const activeOrders = useMemo(() => orders.filter(o => !['cancelled', 'returned'].includes(o.status)), [orders]);
  const repairRevenue = useMemo(() => activeOrders.reduce((s, o) => s + (o.subtotal ?? (o.total_price || 0) / 1.15), 0), [activeOrders]);
  const productRevenue = useMemo(() => sales.reduce((s, inv) => s + (inv.subtotal || 0), 0), [sales]);
  // صافي إشعارات الدائن/المدين المُبلَّغة فعلياً لزاتكا بهذه الفترة —
  // إشعار دائن يُخفّض الإيراد، إشعار مدين يزيده
  const netNotesAdjustment = useMemo(() => creditNotes.reduce((s, n) => {
    const net = (n.amount || 0) - (n.vat_amount || 0);
    return s + (n.note_type === 'credit' ? -net : net);
  }, 0), [creditNotes]);
  const totalRevenue = repairRevenue + productRevenue + netNotesAdjustment;

  const manualExpenseTotal = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const expenseByCategory = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + (e.amount || 0); });
    return Object.entries(map).map(([k, v]) => ({ name: EXPENSE_CATEGORIES[k] || k, value: Math.round(v) }));
  }, [expenses]);

  // تكلفة مواد الورشة: نفضّل رقم التسوية المصادق عليه للأشهر المُسوّاة
  // ضمن الفترة، ونضيف مسحوبات خام لأي أيام/أشهر غير مُسوّاة بعد.
  const materialCost = useMemo(() => {
    const monthsInRange = new Set();
    let cursor = startOfMonth(start);
    while (cursor <= end) { monthsInRange.add(monthKeyOf(cursor)); cursor = startOfMonth(subMonths(cursor, -1)); }
    const settledKeys = new Set(settlements.filter(s => monthsInRange.has(s.month_key)).map(s => s.month_key));
    const settledCost = settlements.filter(s => monthsInRange.has(s.month_key)).reduce((a, s) => a + (s.total_workshop_cost || 0), 0);
    const rawUnsettled = custodies
      .filter(c => !settledKeys.has(c.month_key))
      .reduce((a, c) => a + (c.total_cost || 0), 0);
    return { total: settledCost + rawUnsettled, hasEstimate: custodies.some(c => !settledKeys.has(c.month_key)) };
  }, [custodies, settlements, start, end]);

  const totalExpenses = manualExpenseTotal + materialCost.total;
  const netProfit = totalRevenue - totalExpenses;

  // ضرائب — فقط الفواتير المُبلَّغة فعلياً لزاتكا (رقم رسمي يُعتمد عليه)
  const reportedOrders = orders.filter(o => o.zatca_status === 'REPORTED');
  const reportedSales = sales.filter(s => s.zatca_status === 'REPORTED');
  const vatCollected = [...reportedOrders, ...reportedSales].reduce((s, r) => {
    // نفس إصلاح TaxDashboard: نعتمد على vat_amount المخزَّن فعلياً بدل افتراض 15% دائماً،
    // لاحترام حالة تعطيل الضريبة (vat_enabled) على مستوى الطلب.
    if (r.vat_amount != null) return s + Number(r.vat_amount);
    const sub = r.subtotal ?? (r.total_price ? r.total_price / 1.15 : 0);
    return s + sub * 0.15;
  }, 0) + creditNotes.reduce((s, n) => s + (n.note_type === 'credit' ? -(n.vat_amount || 0) : (n.vat_amount || 0)), 0);
  const unreportedCount = (orders.length + sales.length) - (reportedOrders.length + reportedSales.length);

  const statementRows = useMemo(() => {
    const rows = [];
    orders.forEach(o => rows.push({ date: o.created_at, type: 'إيراد — إصلاح', desc: `${o.order_number || ''} ${o.customer_name || ''}`.trim(), amount: o.subtotal ?? (o.total_price || 0) / 1.15, sign: 1 }));
    sales.forEach(s => rows.push({ date: s.created_at, type: 'إيراد — منتجات', desc: s.invoice_number || '', amount: s.subtotal || 0, sign: 1 }));
    expenses.forEach(e => rows.push({ date: e.expense_date, type: `مصروف — ${EXPENSE_CATEGORIES[e.category] || e.category}`, desc: e.description || '', amount: e.amount || 0, sign: -1 }));
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, sales, expenses]);

  const addExpense = async () => {
    if (!newExpense.amount || Number(newExpense.amount) <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return; }
    if (newExpense.has_vat && newExpense.supplier_vat_number && !/^3\d{13}3$/.test(newExpense.supplier_vat_number.trim())) {
      toast.error('الرقم الضريبي للمورد غير صحيح — يجب أن يكون 15 رقم ويبدأ وينتهي بـ 3'); return;
    }
    try {
      const amount = Number(newExpense.amount);
      // المبلغ المُدخل نعتبره شامل الضريبة (متطابق مع كيفية استلام معظم فواتير
      // المصروفات اليومية: إيجار، كهرباء...). نستخرج منه الضريبة والصافي.
      const vatAmount = newExpense.has_vat ? +(amount - amount / 1.15).toFixed(2) : 0;
      const subtotal = +(amount - vatAmount).toFixed(2);
      await db.Expense.create({
        category: newExpense.category,
        description: newExpense.description,
        amount,
        subtotal,
        vat_amount: vatAmount,
        is_vat_applicable: newExpense.has_vat,
        has_tax_invoice: newExpense.has_vat ? newExpense.has_tax_invoice : false,
        supplier_vat_number: newExpense.has_vat ? (newExpense.supplier_vat_number || null) : null,
        expense_date: newExpense.expense_date,
        created_by: session?.name || 'admin',
      });
      toast.success('تمت إضافة المصروف ✅');
      setNewExpense({ category: 'other', description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'), has_vat: false, has_tax_invoice: false, supplier_vat_number: '' });
      load();
    } catch (err) { toast.error('فشل الحفظ: ' + err.message); }
  };

  const exportPDF = async () => {
    if (!statementRef.current) return;
    setExporting(true);
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
      pdf.save(`كشف-حساب-${format(start, 'yyyy-MM-dd')}-${format(end, 'yyyy-MM-dd')}.pdf`);
    } finally { setExporting(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: start.toISOString(), end: end.toISOString() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'فشل التصدير'); }

      // تحقق دفاعي: لو رجع رد بصيغة غير صحيحة (مثلاً صفحة HTML بدل ملف
      // إكسل فعلي — يحصل هذا لو المسار ما وصل الدالة الصحيحة) كنا نحمّله
      // مباشرة باسم .xlsx فيفشل إكسل بفتحه بدون أي تفسير للمستخدم عن السبب
      const contentType = res.headers.get('content-type') || '';
      const isSpreadsheet = contentType.includes('spreadsheetml') || contentType.includes('application/vnd.openxmlformats');
      if (!isSpreadsheet) {
        throw new Error('الخادم رجّع رد غير متوقع (مو ملف إكسل) — تأكد إن دالة /api/reports/export-excel شغالة على الاستضافة، أو تواصل مع الدعم');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `كشف-حساب-${format(start, 'yyyy-MM-dd')}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); } finally { setExporting(false); }
  };

  if (!isAdmin) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Shield className="w-8 h-8 ml-2" /> هذه الصفحة للمسؤولين فقط</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center"><Wallet className="w-5 h-5 text-blue-700 dark:text-blue-300" /></div>
        <div>
          <h1 className="text-xl font-black">التقارير المالية</h1>
          <p className="text-sm text-gray-500">أرقام حقيقية من قاعدة البيانات — إيراد فعلي، مصاريف مصنّفة، ضرائب مُبلَّغة</p>
        </div>
        <div className="mr-auto flex gap-2 flex-wrap">
          {Object.keys(PRESETS).map((k) => (
            <Button key={k} size="sm" variant={preset === k ? 'default' : 'outline'} onClick={() => applyPreset(k)}>
              {{ thisMonth: 'هذا الشهر', lastMonth: 'الشهر الماضي', thisQuarter: 'هذا الربع', thisYear: 'هذه السنة' }[k]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>

      {/* ── بطاقات ملخّص ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={TrendingUp} label="الإيراد الفعلي" value={totalRevenue} color="green" sub={`إصلاح ${fmt(repairRevenue)} + منتجات ${fmt(productRevenue)}${netNotesAdjustment ? ` ${netNotesAdjustment >= 0 ? '+' : '−'} ${fmt(Math.abs(netNotesAdjustment))} إشعارات` : ''}`} />
        <SummaryCard icon={TrendingDown} label="المصاريف" value={totalExpenses} color="red" sub={materialCost.hasEstimate ? 'يشمل تقدير مواد غير مُسوّاة' : 'مصاريف + مواد مُسوّاة'} />
        <SummaryCard icon={Wallet} label="صافي الربح" value={netProfit} color={netProfit >= 0 ? 'blue' : 'red'} sub="إيراد − مصاريف" />
        <SummaryCard icon={Receipt} label="ضريبة مُحصّلة (مُبلَّغة)" value={vatCollected} color="purple" sub={unreportedCount > 0 ? `⚠️ ${unreportedCount} فاتورة لسا ما أُبلغت` : 'كل الفواتير مُبلَّغة'} />
      </div>

      {/* لي / علي — أرصدة لحظية، غير مرتبطة بالفترة المختارة أعلاه */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard icon={TrendingUp} label="كم لي (مستحق على العملاء)" value={receivable} color="green" sub="طلبات وفواتير غير مدفوعة حالياً" />
        <SummaryCard icon={TrendingDown} label="كم عليّ (مستحق للموردين)" value={payable} color="red" sub="فواتير شراء غير مسدَّدة حالياً" />
      </div>

      {/* ── الرسم البياني ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">اتجاه آخر 6 أشهر</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => `${fmt(v)} ر.س`} />
                <Legend />
                <Bar dataKey="الإيراد" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="المصاريف" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">توزيع المصاريف</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {expenseByCategory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">لا مصاريف يدوية بهذه الفترة</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${fmt(v)} ر.س`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── إضافة مصروف يدوي ───────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" />تسجيل مصروف جديد</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">التصنيف</Label>
            <Select value={newExpense.category} onValueChange={(v) => setNewExpense(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">الوصف</Label>
            <Input value={newExpense.description} onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))} placeholder="مثال: إيجار شهر يوليو" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">التاريخ</Label>
            <Input type="date" value={newExpense.expense_date} onChange={e => setNewExpense(p => ({ ...p, expense_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">المبلغ (ر.س)</Label>
            <div className="flex gap-2">
              <Input type="number" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
              <Button onClick={addExpense}>إضافة</Button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer pt-1">
              <input type="checkbox" checked={newExpense.has_vat} onChange={e => setNewExpense(p => ({ ...p, has_vat: e.target.checked, has_tax_invoice: e.target.checked ? p.has_tax_invoice : false }))} />
              المبلغ شامل ضريبة 15%
            </label>
            {newExpense.has_vat && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer pt-1">
                  <input type="checkbox" checked={newExpense.has_tax_invoice} onChange={e => setNewExpense(p => ({ ...p, has_tax_invoice: e.target.checked }))} />
                  عندي فاتورة ضريبية رسمية من المورد (بدونها الضريبة غير قابلة للخصم رسمياً)
                </label>
                <Input className="mt-1" value={newExpense.supplier_vat_number} onChange={e => setNewExpense(p => ({ ...p, supplier_vat_number: e.target.value }))} placeholder="الرقم الضريبي للمورد (15 رقم)" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── كشف الحساب القابل للتصدير ──────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />كشف الحساب — {format(start, 'yyyy-MM-dd')} إلى {format(end, 'yyyy-MM-dd')}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportPDF} disabled={exporting} className="gap-1.5"><FileDown className="w-4 h-4" />PDF</Button>
            <Button size="sm" variant="outline" onClick={exportExcel} disabled={exporting} className="gap-1.5"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={statementRef} className="bg-white p-6 rounded-lg" dir="rtl">
            <div className="text-center mb-6 border-b pb-4">
              <h2 className="text-lg font-black">كشف حساب مالي</h2>
              <p className="text-sm text-gray-500">{format(start, 'yyyy-MM-dd')} — {format(end, 'yyyy-MM-dd')}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6 text-center">
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg"><div className="text-xs text-gray-500">إجمالي الإيراد</div><div className="font-black text-green-700 dark:text-green-300">{fmt(totalRevenue)}</div></div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg"><div className="text-xs text-gray-500">إجمالي المصاريف</div><div className="font-black text-red-700 dark:text-red-300">{fmt(totalExpenses)}</div></div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg"><div className="text-xs text-gray-500">صافي الربح</div><div className="font-black text-blue-700 dark:text-blue-300">{fmt(netProfit)}</div></div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500 text-xs">
                <th className="text-right py-2">التاريخ</th><th className="text-right py-2">النوع</th>
                <th className="text-right py-2">الوصف</th><th className="text-left py-2">المبلغ</th>
              </tr></thead>
              <tbody>
                {statementRows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 text-xs text-gray-500">{r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '—'}</td>
                    <td className="py-1.5">{r.type}</td>
                    <td className="py-1.5 text-gray-600">{r.desc}</td>
                    <td className={`py-1.5 text-left font-mono ${r.sign > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {r.sign > 0 ? '+' : '-'}{fmt(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, sub }) {
  const colors = {
    green: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300', red: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300',
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300', purple: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${colors[color]}`}><Icon className="w-4.5 h-4.5" /></div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-black">{fmt(value)} <span className="text-xs font-normal text-gray-400">ر.س</span></div>
        {sub && <div className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</div>}
      </CardContent>
    </Card>
  );
}
