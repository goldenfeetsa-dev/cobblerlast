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
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { db, APP_SETTINGS_SAFE_COLUMNS } from '@/api/supabaseApi';
import { secureExpenses } from '@/lib/secureApi';
import { getSession } from '@/lib/sessionStore';
import { isFinanceUser } from '@/lib/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Receipt, FileDown, FileSpreadsheet,
  Plus, Shield, Calendar, RefreshCw,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, startOfQuarter } from 'date-fns';
import { SarAmount, Sar, SarSymbol } from '@/components/shared/SarCurrency';
import { fetchAccountingReport } from '@/lib/accounting';

// نفس قيم نوع expense_category في قاعدة البيانات حرفياً (كان «utilities» غير موجود فيُرفض الحفظ)
const EXPENSE_CATEGORIES = {
  rent: 'إيجار', salaries: 'رواتب', electricity: 'كهرباء', water: 'مياه', internet: 'إنترنت واتصالات',
  supplies: 'مستلزمات', maintenance: 'صيانة', marketing: 'تسويق', transportation: 'نقل ومواصلات', other: 'أخرى',
};
const CHART_COLORS = ['#14407a', '#b42318', '#127a4a', '#9a6700', '#111827', '#6b7280', '#9aa1ad'];
const fmtN = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  // محرك المحاسبة الموحّد — مصدر الأرقام الرئيسية (نفس أرقام المركز المحاسبي وتطبيق الجوال)
  const [engine, setEngine] = useState(null);
  const [creditNotes, setCreditNotes] = useState([]);
  const [receivable, setReceivable] = useState(0);
  const [payable, setPayable] = useState(0);
  const [newExpense, setNewExpense] = useState({ category: 'other', description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'), has_vat: false, has_tax_invoice: false, supplier_vat_number: '' });
  const [exporting, setExporting] = useState(false);
  const statementRef = useRef(null);
  const [shop, setShop] = useState({});
  useEffect(() => {
    db.AppSettings.list('-created_at', 1, APP_SETTINGS_SAFE_COLUMNS).then((r) => setShop((r && r[0]) || {})).catch(() => {});
  }, []);

  const [start, end] = range;

  const load = async () => {
    setLoading(true);
    const startISO = start.toISOString();
    const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();
    const startDay = format(start, 'yyyy-MM-dd');
    const endDay = format(end, 'yyyy-MM-dd');

    const [{ data: o }, { data: s }, expensesData, { data: c }, { data: st }, { data: notes }, { data: unpaidOrders }, { data: unpaidSales }, { data: payables }] = await Promise.all([
      // طلبات الشركات خارج الإيراد هنا: تُحتسب مرة وحدة من فاتورتها المجمّعة (sales_invoices).
      supabase.from('orders').select('subtotal,total_price,zatca_status,created_at,order_number,customer_name,status').is('partner_id', null).gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('sales_invoices').select('subtotal,zatca_status,created_at,invoice_number').gte('created_at', startISO).lte('created_at', endISO),
      secureExpenses.list({ orderBy: '-expense_date', limit: 2000, gteCol: 'expense_date', gteVal: startDay, lteCol: 'expense_date', lteVal: endDay }),
      supabase.from('workshop_custodies').select('total_cost,month_key').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('workshop_settlements').select('month_key,total_workshop_cost'),
      supabase.from('zatca_credit_debit_notes').select('note_type,amount,vat_amount,created_at').gte('created_at', startISO).lte('created_at', endISO).eq('zatca_status', 'REPORTED'),
      // "كم لي" — مستحقات على العملاء (غير محصورة بفترة، رقم لحظي)
      supabase.from('orders').select('total_price').eq('payment_status', 'unpaid').neq('status', 'cancelled'), // (قيمة 'returned' غير موجودة بنوع order_status — كانت تسبب خطأ 22P02 فيرجع «كم لي» صفر)
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

    // الأرقام الرئيسية + الاتجاه الشهري من المحرك الموحّد (قاعدة البيانات)
    try {
      const rep = await fetchAccountingReport(start, end);
      setEngine(rep);
      setTrend((rep.trend || []).slice(-6).map((row) => ({
        month: format(new Date(`${row.month}-01T00:00:00`), 'MM/yyyy'),
        الإيراد: Math.round(row.revenue || 0),
        المصاريف: Math.round(row.costs || 0),
      })));
    } catch (err) {
      console.error('accounting engine error', err);
      setEngine(null);
      setTrend([]);
      toast.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { load();   }, [start, end]);

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
  const localRevenue = repairRevenue + productRevenue + netNotesAdjustment;

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

  const IS = engine?.income_statement;
  // المحرك هو المرجع؛ الحساب المحلي احتياطي فقط لو تعذّر الاتصال به
  const totalRevenue = IS ? Number(IS.revenue_total) : localRevenue;
  const totalExpenses = IS ? Number(IS.cost_of_revenue) + Number(IS.operating_expenses) : manualExpenseTotal + materialCost.total;
  const netProfit = IS ? Number(IS.net_profit) : totalRevenue - totalExpenses;

  // ضرائب — فقط الفواتير المُبلَّغة فعلياً لزاتكا (رقم رسمي يُعتمد عليه)
  // ضريبة المخرجات لكل الفواتير الصادرة (المرحلة الأولى — نفس لوحة الضرائب والمحرك).
  // سابقاً كانت تُحتسب للفواتير «المُبلَّغة لزاتكا» فقط فتظهر صفراً دائماً.
  const vatCollected = engine?.vat ? Number(engine.vat.output_vat) : 0;

  const statementRows = useMemo(() => {
    const rows = [];
    activeOrders.forEach(o => rows.push({ date: o.created_at, type: 'إيراد — إصلاح', desc: `${o.order_number || ''} ${o.customer_name || ''}`.trim(), amount: o.subtotal ?? (o.total_price || 0) / 1.15, sign: 1 }));
    sales.forEach(s => rows.push({ date: s.created_at, type: 'إيراد — منتجات', desc: s.invoice_number || '', amount: s.subtotal || 0, sign: 1 }));
    expenses.forEach(e => rows.push({ date: e.expense_date, type: `مصروف — ${EXPENSE_CATEGORIES[e.category] || e.category}`, desc: e.description || '', amount: e.amount || 0, sign: -1 }));
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [activeOrders, sales, expenses]);

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

  // PDF حقيقي بنص قابل للتحديد والبحث: نافذة الطباعة بقالب A4 مخصّص (اختر «حفظ كـ PDF»)
  const exportPDF = () => { window.print(); };

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

  const statementDoc = (
          <div className="fin-statement" dir="rtl">
            <div className="fh">
              <div className="fl">
                <img src="/images/cobblers-official-mark.png" alt="" />
                <div>
                  <b>{shop.shop_name || 'إبرة وخيط الإسكافي'}</b>
                  <div>
                    Needle &amp; Thread Cobbler<br />
                    {[shop.address, shop.city].filter(Boolean).join('، ')}{shop.phone ? ` · ${shop.phone}` : ''}<br />
                    {shop.vat_number ? <>الرقم الضريبي: <span dir="ltr">{shop.vat_number}</span></> : null}{shop.cr_number ? <> · السجل التجاري: <span dir="ltr">{shop.cr_number}</span></> : null}
                  </div>
                </div>
              </div>
              <div className="ft"><small>Financial Statement</small><h2>كشف حساب مالي</h2><div dir="ltr" style={{ fontSize: 11, color: '#6b7280' }}>FS-{format(end, 'yyMM')}-{format(start, 'dd')}{format(end, 'dd')}</div></div>
            </div>
            <div className="fm">
              <div><small>الفترة · Period</small><b dir="ltr">{format(start, 'yyyy-MM-dd')} → {format(end, 'yyyy-MM-dd')}</b></div>
              <div><small>إجمالي الإيراد · Revenue</small><b>{fmtN(totalRevenue)}</b></div>
              <div><small>إجمالي المصاريف · Expenses</small><b>{fmtN(totalExpenses)}</b></div>
              <div><small>صافي الربح · Net profit</small><b style={{ color: netProfit < 0 ? '#b42318' : undefined }}><Sar>{fmtN(netProfit)}</Sar></b></div>
            </div>
            <table>
              <thead><tr>
                <th>التاريخ<i>Date</i></th><th>النوع<i>Type</i></th><th>الوصف<i>Description</i></th>
                <th className="l">إيراد<i>Credit</i></th><th className="l">مصروف<i>Debit</i></th><th className="l">الرصيد<i>Balance</i></th>
              </tr></thead>
              <tbody>
                {(() => { let run = 0; return statementRows.map((r, i) => { run += r.sign > 0 ? r.amount : -r.amount; return (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '—'}</td>
                    <td>{r.type}</td>
                    <td style={{ color: '#4b5563' }}>{r.desc}</td>
                    <td className="l">{r.sign > 0 ? fmtN(r.amount) : ''}</td>
                    <td className="l">{r.sign < 0 ? fmtN(r.amount) : ''}</td>
                    <td className="l"><b>{fmtN(run)}</b></td>
                  </tr>
                ); }); })()}
                {statementRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>لا توجد حركات في هذه الفترة</td></tr>}
              </tbody>
            </table>
            <div className="ff"><span>{shop.shop_name || 'إبرة وخيط الإسكافي'} · needlecobbler.com{shop.phone ? ` · ${shop.phone}` : ''}</span><span>صدر {format(new Date(), 'yyyy-MM-dd')} · أُعدّ آلياً من النظام</span></div>
          </div>
  );

  if (!isAdmin) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Shield className="w-8 h-8 ml-2" /> هذه الصفحة للمسؤولين فقط</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 border border-foreground bg-card flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
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
        <SummaryCard icon={TrendingUp} label="الإيراد الفعلي" value={totalRevenue} color="green" sub={IS ? `إصلاح ${fmt(IS.revenue_repair)} + منتجات ${fmt(IS.revenue_products)} + شركات ${fmt(IS.revenue_partners)}` : `إصلاح ${fmt(repairRevenue)} + منتجات ${fmt(productRevenue)}`} />
        <SummaryCard icon={TrendingDown} label="المصاريف" value={totalExpenses} color="red" sub={materialCost.hasEstimate ? 'يشمل تقدير مواد غير مُسوّاة' : 'مصاريف + مواد مُسوّاة'} />
        <SummaryCard icon={Wallet} label="صافي الربح" value={netProfit} color={netProfit >= 0 ? 'blue' : 'red'} sub="إيراد − تكلفة الإيراد − مصاريف" />
        <SummaryCard icon={Receipt} label="ضريبة المخرجات" value={vatCollected} color="purple" sub={engine?.vat ? `الصافي المستحق بعد المدخلات: ${fmt(engine.vat.net_vat_due)}` : 'كل الفواتير الصادرة'} />
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
                <Tooltip formatter={(v) => <Sar>{fmt(v)}</Sar>} />
                <Legend />
                <Bar dataKey="الإيراد" fill="#14407a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="المصاريف" fill="#b7bdc8" radius={[0, 0, 0, 0]} />
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
                  <Tooltip formatter={(v) => <Sar>{fmt(v)}</Sar>} />
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
            <Label className="text-xs">المبلغ (<SarSymbol />)</Label>
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
      <style>{`
        .fin-statement{font-family:'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif;color:#111827;background:#fff;font-size:12px;border:1px solid hsl(var(--border));padding:34px 38px}
        .fin-statement *{font-variant-numeric:tabular-nums}
        .fin-statement .fh{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #111827}
        .fin-statement .fh img{height:56px;width:auto;filter:brightness(0)}
        .fin-statement .fl{display:flex;gap:14px;align-items:center}
        .fin-statement .fl b{font-size:16px;display:block}
        .fin-statement .fl div div{color:#6b7280;font-size:10.5px;line-height:1.7;margin-top:3px}
        .fin-statement .ft{text-align:left}
        .fin-statement .ft small{font-size:10.5px;letter-spacing:.22em;color:#6b7280;text-transform:uppercase}
        .fin-statement .ft h2{font-size:26px;font-weight:700;margin:2px 0}
        .fin-statement .fm{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #111827;margin:16px 0}
        .fin-statement .fm div{padding:9px 13px;border-inline-start:1px solid #d1d5db}
        .fin-statement .fm div:first-child{border:0}
        .fin-statement .fm small{display:block;font-size:9.5px;color:#6b7280;margin-bottom:2px}
        .fin-statement .fm b{font-size:15px}
        .fin-statement table{width:100%;border-collapse:collapse}
        .fin-statement th{background:#f3f4f6;font-size:10.5px;font-weight:600;text-align:right;padding:8px 9px;border-top:1px solid #111827;border-bottom:1px solid #111827}
        .fin-statement th i{display:block;font-style:normal;font-weight:400;color:#6b7280;font-size:9px}
        .fin-statement td{padding:8px 9px;border-bottom:1px solid #e5e7eb;font-size:11.5px}
        .fin-statement .l{text-align:left}
        .fin-statement .ff{display:flex;justify-content:space-between;margin-top:22px;padding-top:10px;border-top:1px solid #d1d5db;font-size:10px;color:#6b7280}
        @media print{
          @page{size:A4;margin:10mm}
          #root{display:none!important}
          #fin-print{display:block!important}
          .fin-statement{border:0;padding:0}
          .fin-statement tr{break-inside:avoid}
          .fin-statement *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        }
      `}</style>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />كشف الحساب — {format(start, 'yyyy-MM-dd')} إلى {format(end, 'yyyy-MM-dd')}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportPDF} disabled={exporting} className="gap-1.5"><FileDown className="w-4 h-4" />طباعة / PDF</Button>
            <Button size="sm" variant="outline" onClick={exportExcel} disabled={exporting} className="gap-1.5"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
          </div>
        </CardHeader>
        <CardContent>
          {statementDoc}
        </CardContent>
      </Card>
      {typeof document !== 'undefined' && createPortal(<div id="fin-print" style={{ display: 'none' }}>{statementDoc}</div>, document.body)}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, sub }) {
  const bar = { green: '#127a4a', red: '#b42318', blue: '#14407a', purple: '#111827' }[color] || '#111827';
  return (
    <div className="bg-card border border-border relative p-5">
      <div className="absolute top-0 inset-x-0 h-[3px]" style={{ background: bar }} />
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><Icon className="w-4 h-4" /></div>
      <div className="text-2xl font-semibold mt-3 tnum"><SarAmount value={value} /></div>
      {sub && <div className="text-[11.5px] text-muted-foreground mt-1.5 truncate">{sub}</div>}
    </div>
  );
}
