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
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { secureExpenses, secureZatca } from '@/lib/secureApi';
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

// ملاحظة مهمة: locale 'ar-SA' يعرض الأرقام بالهندي (٠١٢٣٤...) في أغلب
// المتصفحات، وهذا كان سبب ظهور أرقام غير مقروءة/غير متوافقة مع الأنظمة
// بالمستند المُصدَّر. نستخدم 'en-US' للحصول على أرقام إنجليزية (Latin)
// دائماً مع الحفاظ على الفواصل العشرية بنفس الشكل.
const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [allExpenses, setAllExpenses] = useState([]); // بدون فلترة is_vat_applicable — للأرباح والمصروفات الكاملة
  const [suppliersById, setSuppliersById] = useState({});
  const [zatcaSettings, setZatcaSettings] = useState(null);
  const [creditNotes, setCreditNotes] = useState([]);
  // لحظة إنشاء التقرير بالضبط (تاريخ + ساعة + دقيقة + ثانية) — تُلتقط
  // وقت الضغط الفعلي على PDF أو Excel، مو وقت فتح الصفحة أو أي إعادة رسم
  const [preparedAt, setPreparedAt] = useState(null);
  const taxStatementRef = useRef(null);
  const managementStatementRef = useRef(null);

  const [start, end] = range;

  const load = async () => {
    setLoading(true);
    const startISO = start.toISOString();
    const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();
    const startDay = format(start, 'yyyy-MM-dd');
    const endDay = format(end, 'yyyy-MM-dd');

    const [{ data: o }, { data: s }, { data: p }, expensesRaw, { data: sup }, zs, { data: notes }] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('sales_invoices').select('*').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('purchase_invoices').select('*').gte('invoice_date', startDay).lte('invoice_date', endDay),
      secureExpenses.list({ orderBy: '-expense_date', limit: 2000, gteCol: 'expense_date', gteVal: startDay, lteCol: 'expense_date', lteVal: endDay }),
      supabase.from('suppliers').select('id,name'),
      secureZatca.getSettings().catch(() => null),
      supabase.from('zatca_credit_debit_notes').select('*').gte('created_at', startISO).lte('created_at', endISO).eq('zatca_status', 'REPORTED'),
    ]);
    setOrders(o || []); setSales(s || []); setPurchases(p || []);
    setAllExpenses(expensesRaw || []);
    setExpenses((expensesRaw || []).filter((x) => x.is_vat_applicable));
    setSuppliersById(Object.fromEntries((sup || []).map(x => [x.id, x.name])));
    setZatcaSettings(zs || null);
    setCreditNotes(notes || []);
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
  const vatCollected = useMemo(() => {
    // نعتمد على vat_amount المخزَّن فعلياً بكل طلب/فاتورة (وليس إعادة حسابه دائماً
    // بافتراض 15%) — لأن بعض الطلبات قد تُنشأ والضريبة معطّلة (إعداد vat_enabled
    // بصفحة الإعدادات)، وبهذي الحالة vat_amount = 0 فعلياً ويجب احترام ذلك.
    const invoicesVat = [...reportedOrders, ...reportedSales].reduce((s, r) => {
      if (r.vat_amount != null) return s + Number(r.vat_amount);
      const sub = r.subtotal ?? (r.total_price ? r.total_price / 1.15 : 0);
      return s + sub * 0.15;
    }, 0);
    const notesAdjustment = creditNotes.reduce((s, n) => s + (n.note_type === 'credit' ? -(n.vat_amount || 0) : (n.vat_amount || 0)), 0);
    return invoicesVat + notesAdjustment;
  }, [orders, sales, creditNotes]);

  // ── ضريبة المدخلات (المشتريات) — فقط الفواتير بمورد له رقم ضريبي صالح ──
  const validPurchases = purchases.filter(p => p.vat_number_valid_format);
  const invalidPurchases = purchases.filter(p => !p.vat_number_valid_format);
  const vatPaidPurchases = validPurchases.reduce((s, p) => s + (Number(p.vat_amount) || 0), 0);
  const vatPaidExcluded = invalidPurchases.reduce((s, p) => s + (Number(p.vat_amount) || 0), 0);

  // ── ضريبة المصروفات القابلة للخصم — فقط اللي عليها فاتورة ضريبية رسمية
  // من المورد (شرط زاتكا لقبول خصم ضريبة المدخلات) ──
  const deductibleExpenses = expenses.filter(e => e.has_tax_invoice);
  const nonDeductibleExpenses = expenses.filter(e => !e.has_tax_invoice);
  const vatPaidExpenses = deductibleExpenses.reduce((s, e) => s + (Number(e.vat_amount) || 0), 0);
  const vatExpensesExcluded = nonDeductibleExpenses.reduce((s, e) => s + (Number(e.vat_amount) || 0), 0);

  const vatPaidDeductible = vatPaidPurchases + vatPaidExpenses;
  const netVatDue = vatCollected - vatPaidDeductible;

  // ═══ القسم الجديد: الإيرادات والمصروفات وصافي الربح (تقرير مفصّل) ═══
  // ملاحظة مهمة: هذا القسم يعتمد على *كل* الطلبات/الفواتير المكتملة
  // بالفترة (بغض النظر عن حالة زاتكا) — بعكس قسم ضريبة المخرجات فوق
  // اللي يقتصر على المُبلَّغة فقط لزاتكا. السبب: الربح الفعلي محاسبياً
  // لا علاقة له بحالة الإبلاغ لزاتكا، هو إيراد حقيقي تحقق فعلاً.
  const completedOrders = orders.filter(o => o.status !== 'cancelled');
  const completedSales = sales; // فواتير المبيعات كلها مكتملة أصلاً وقت الإصدار

  const revenueBeforeVat = useMemo(() => {
    const fromOrders = completedOrders.reduce((s, o) => s + Number(o.subtotal ?? (o.total_price ? o.total_price / 1.15 : 0)), 0);
    const fromSales = completedSales.reduce((s, x) => s + Number(x.subtotal ?? (x.total ? x.total / 1.15 : 0)), 0);
    return fromOrders + fromSales;
  }, [orders, sales]);

  const totalPurchasesBeforeVat = purchases.reduce((s, p) => s + (Number(p.taxable_amount) || 0), 0);

  const totalExpensesBeforeVat = allExpenses.reduce((s, e) => s + Number(e.subtotal ?? e.amount ?? 0), 0);
  const expensesByCategory = useMemo(() => {
    const map = {};
    allExpenses.forEach(e => {
      const cat = e.category || 'أخرى';
      map[cat] = (map[cat] || 0) + Number(e.subtotal ?? e.amount ?? 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [allExpenses]);

  // صافي الربح = الإيرادات (قبل الضريبة) − المشتريات (تكلفة البضاعة/المواد) − المصروفات التشغيلية
  const netProfit = revenueBeforeVat - totalPurchasesBeforeVat - totalExpensesBeforeVat;
  const profitMargin = revenueBeforeVat > 0 ? (netProfit / revenueBeforeVat) * 100 : 0;

  // ═══ مستند 1: تقرير الأداء الإداري (للمدير/المالك) — بدون أي تفاصيل ضريبية ═══
  const managementSections = [
    {
      title: 'القسم الأول — الإيرادات (المبيعات)', color: '#0f766e',
      rows: [
        [`إيرادات طلبات الإصلاح (صافي قبل الضريبة) — ${completedOrders.length} طلب`, fmt(completedOrders.reduce((s, o) => s + Number(o.subtotal ?? (o.total_price ? o.total_price / 1.15 : 0)), 0))],
        [`إيرادات مبيعات المنتجات (صافي قبل الضريبة) — ${completedSales.length} فاتورة`, fmt(completedSales.reduce((s, x) => s + Number(x.subtotal ?? (x.total ? x.total / 1.15 : 0)), 0))],
      ],
      total: ['إجمالي الإيرادات (قبل الضريبة)', fmt(revenueBeforeVat)],
    },
    {
      title: 'القسم الثاني — المشتريات (تكلفة البضاعة/المواد)', color: '#b45309',
      rows: [[`إجمالي فواتير المشتريات (قبل الضريبة) — ${purchases.length} فاتورة`, fmt(totalPurchasesBeforeVat)]],
      total: null,
    },
    {
      title: 'القسم الثالث — المصروفات التشغيلية (مبوّبة حسب النوع)', color: '#a21caf',
      rows: expensesByCategory.length === 0 ? [['لا توجد مصروفات مسجّلة بهذه الفترة', '']] : expensesByCategory.map(([cat, amount]) => [cat, fmt(amount)]),
      total: ['إجمالي المصروفات (قبل الضريبة)', fmt(totalExpensesBeforeVat)],
    },
    {
      title: `القسم الرابع — ${netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة'}`, color: netProfit >= 0 ? '#15803d' : '#b91c1c',
      rows: [
        ['إجمالي الإيرادات', fmt(revenueBeforeVat)],
        ['ناقص: إجمالي المشتريات', `(${fmt(totalPurchasesBeforeVat)})`],
        ['ناقص: إجمالي المصروفات التشغيلية', `(${fmt(totalExpensesBeforeVat)})`],
        ['هامش الربح', `${profitMargin.toFixed(1)}%`],
      ],
      total: [netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة', `${fmt(Math.abs(netProfit))} ر.س`],
      totalColor: netProfit >= 0 ? '#15803d' : '#b91c1c',
      big: true,
    },
  ];

  // ═══ مستند 2: الإقرار الضريبي الرسمي (لزاتكا) — مبيعات ومشتريات فقط ═══
  const taxSections = [
    {
      title: 'القسم الأول — المبيعات', color: '#16a34a',
      rows: [
        ['صافي المبيعات (قبل الضريبة) المُبلَّغة لزاتكا', fmt(vatCollected / 0.15)],
        ['ضريبة القيمة المضافة على المبيعات', fmt(vatCollected)],
      ],
      total: ['إجمالي المبيعات شامل الضريبة', fmt((vatCollected / 0.15) + vatCollected)],
      note: unreportedCount > 0
        ? `* ${unreportedCount} طلب/فاتورة بهذه الفترة غير مُبلَّغ لزاتكا بعد — غير محتسب هنا`
        : (creditNotes.length > 0 ? '* شامل صافي إشعارات الدائن/المدين المُصدرة بهذه الفترة' : null),
    },
    {
      title: 'القسم الثاني — المشتريات', color: '#2563eb',
      rows: [
        ['صافي المشتريات (قبل الضريبة)', fmt(totalPurchasesBeforeVat)],
        ['ضريبة القيمة المضافة على المشتريات (قابلة للخصم)', fmt(vatPaidDeductible)],
      ],
      total: ['إجمالي المشتريات شامل الضريبة', fmt(totalPurchasesBeforeVat + vatPaidDeductible)],
      note: vatExpensesExcluded > 0 ? `⚠ ${fmt(vatExpensesExcluded)} ر.س ضريبة مصروفات مستبعدة لعدم وجود فاتورة ضريبية رسمية من المورد` : null,
    },
  ];

  const renderSection = (section, idx) => (
    <div className="mb-5" key={idx}>
      <div className="text-white font-bold px-4 py-2 rounded-t-md" style={{ background: section.color, fontSize: '13px' }}>{section.title}</div>
      <table className="w-full border border-t-0 rounded-b-md" style={{ borderCollapse: 'collapse', fontSize: section.big ? '15px' : '13px' }}>
        <tbody>
          {section.rows.map(([label, value], i) => (
            <tr key={i} className={i > 0 ? 'border-t' : ''} style={{ borderColor: '#f3f4f6' }}>
              <td className="py-2 px-4" style={{ textAlign: 'right' }}>{label}</td>
              <td className="py-2 px-4 font-bold" dir="ltr" style={{ textAlign: 'left', width: '160px', fontVariantNumeric: 'tabular-nums' }}>{value}</td>
            </tr>
          ))}
          {section.total && (
            <tr className="border-t-2 font-black" style={{ borderColor: '#d1d5db' }}>
              <td className="py-3 px-4" style={{ textAlign: 'right' }}>{section.total[0]}</td>
              <td className="py-3 px-4" dir="ltr" style={{ textAlign: 'left', width: '160px', fontVariantNumeric: 'tabular-nums', color: section.totalColor || 'inherit' }}>{section.total[1]}</td>
            </tr>
          )}
        </tbody>
      </table>
      {section.note && <p style={{ fontSize: '10px', color: '#d97706', marginTop: '4px' }}>{section.note}</p>}
    </div>
  );

  const DocHeader = ({ subtitle }) => (
    <>
      <div className="flex items-center justify-between border-b-4 pb-5 mb-6" style={{ borderColor: '#4a2e18' }}>
        <div className="flex items-center gap-4">
          <img src="/images/logo-cobblers.png" alt="الشعار" className="w-16 h-16 rounded-lg object-contain" style={{ background: '#6b4226' }} />
          <div>
            <h2 className="text-xl font-black" style={{ color: '#4a2e18' }}>{zatcaSettings?.seller_name || 'إبرة وخيط الإسكافي'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <table dir="rtl" style={{ fontSize: '11px', color: '#6b7280' }}>
          <tbody>
            <tr><td className="pl-2 text-gray-400">الفترة</td><td className="font-bold text-gray-700" dir="ltr" style={{ textAlign: 'left' }}>{format(start, 'yyyy-MM-dd')} — {format(end, 'yyyy-MM-dd')}</td></tr>
            <tr><td className="pl-2 text-gray-400">تاريخ ووقت الإعداد</td><td className="font-bold text-gray-700" dir="ltr" style={{ textAlign: 'left' }}>{format(preparedAt || new Date(), 'yyyy-MM-dd HH:mm:ss')}</td></tr>
          </tbody>
        </table>
      </div>
      <table className="w-full mb-7 text-sm" style={{ borderCollapse: 'separate', borderSpacing: '10px 0' }}>
        <tbody>
          <tr>
            <td className="p-3 rounded-lg w-1/2" style={{ background: '#fbf6ee' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af' }}>الرقم الضريبي (VAT)</p>
              <p className="font-bold" dir="ltr" style={{ textAlign: 'right', color: zatcaSettings?.vat_number ? '#000' : '#b5442e' }}>
                {zatcaSettings?.vat_number || 'غير مضبوط — يُرجى إدخاله قبل التقديم الرسمي'}
              </p>
            </td>
            <td className="p-3 rounded-lg w-1/2" style={{ background: '#fbf6ee' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af' }}>السجل التجاري (C.R)</p>
              <p className="font-bold" dir="ltr" style={{ textAlign: 'right' }}>{zatcaSettings?.cr_number || '—'}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  const exportReturn = async () => {
    setExporting(true);
    setPreparedAt(new Date());
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
  // ─────────────────────────────────────────────────────────────
  // كانت النسخة القديمة تفرض صفحة A4 عمودية ثابتة (210×297mm) ثم
  // "تقص" الصورة على عدة صفحات كلما زاد المحتوى — ولهذا كان الإقرار
  // يطلع بعدة صفحات مقطّعة بدل صفحة واحدة واضحة.
  // الحل: نحسب أبعاد صفحة PDF مخصصة (Custom page size) تطابق نسبة
  // طول/عرض الصورة الملتقطة فعلياً، بعرض ثابت وواسع (landscape-style)،
  // فتصير النتيجة صفحة واحدة دائماً مهما طال المحتوى، وبدقة أعلى
  // (scale أعلى) لجودة طباعة أوضح.
  const [exportingWhich, setExportingWhich] = useState(null); // 'tax' | 'management' | null
  const exportPDF = async (ref, filenamePrefix, which) => {
    if (!ref.current) return;
    setExportingWhich(which);
    // flushSync يضمن إن التوقيت (بالثانية) يظهر فعلياً بالـ DOM قبل ما
    // html2canvas يصوّر المستند — بدون هذا، setState العادي غير متزامن
    // وممكن يصوّر النسخة قبل التحديث.
    flushSync(() => setPreparedAt(new Date()));
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 3,               // دقة أعلى = جودة طباعة أفضل (كانت 2)
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png', 1.0);

      // عرض ثابت وواسع (مثل صفحة A3 landscape تقريباً) حتى لا تُقصّ
      // أي أعمدة بجدول المشتريات، والارتفاع يُحسب تلقائياً من نسبة
      // الصورة نفسها فتُطبع دائماً بصفحة واحدة فقط.
      const pageWidthMM = 340; // أعرض من A4 (210) وأعرض من A3 (297)
      const pageHeightMM = (canvas.height * pageWidthMM) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [pageWidthMM, pageHeightMM], // صفحة مخصصة بمقاس المحتوى بالضبط
        compress: true,
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pageWidthMM, pageHeightMM, undefined, 'FAST');
      pdf.save(`${filenamePrefix}-${format(start, 'yyyy-MM-dd')}-${format(end, 'yyyy-MM-dd')}.pdf`);
      toast.success('تم إنشاء ملف PDF — صفحة واحدة');
    } catch (err) {
      toast.error('تعذّر إنشاء ملف PDF: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setExportingWhich(null);
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
            <FileSpreadsheet className="w-4 h-4 ml-1" /> {exporting ? 'جارِ الإنشاء...' : 'Excel (كل البيانات)'}
          </Button>
          <Button onClick={() => exportPDF(taxStatementRef, 'إقرار-ضريبي-زاتكا', 'tax')} disabled={!!exportingWhich || loading} variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300">
            <FileDown className="w-4 h-4 ml-1" /> {exportingWhich === 'tax' ? 'جارِ الإنشاء...' : 'الإقرار الضريبي (زاتكا) PDF'}
          </Button>
          <Button onClick={() => exportPDF(managementStatementRef, 'تقرير-أداء-إداري', 'management')} disabled={!!exportingWhich || loading}>
            <FileDown className="w-4 h-4 ml-1" /> {exportingWhich === 'management' ? 'جارِ الإنشاء...' : 'تقرير الأداء (للمدير) PDF'}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        📄 <strong>الإقرار الضريبي</strong>: مستند رسمي بأرقام زاتكا فقط (يُستخدم لتعبئة الإقرار الدوري بالبوابة).
        📊 <strong>تقرير الأداء</strong>: مستند داخلي للمدير/المالك — الإيرادات والمشتريات والمصروفات وصافي الربح، بدون تفاصيل ضريبية.
      </p>

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
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              فيه {unreportedCount} فاتورة/طلب مبيعات لسه ما انبلّغ لزاتكا بهذي الفترة — مو محسوبة ضمن ضريبة المخرجات هنا.
            </div>
          )}
          {invalidPurchases.length > 0 && (
            <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              فيه {invalidPurchases.length} فاتورة شراء بمبلغ ضريبة {fmt(vatPaidExcluded)} ر.س مستبعدة من الخصم لأن موردها بدون رقم ضريبي صالح —
              <Link to="/suppliers" className="underline font-bold">حدّث بيانات الموردين</Link>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300"><TrendingUp className="w-4 h-4" /><p className="text-xs font-bold">ضريبة المخرجات (المبيعات)</p></div>
                <p className="text-2xl font-black mt-2 text-green-700 dark:text-green-300">{fmt(vatCollected)} ر.س</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300"><TrendingDown className="w-4 h-4" /><p className="text-xs font-bold">ضريبة المدخلات القابلة للخصم (المشتريات)</p></div>
                <p className="text-2xl font-black mt-2 text-blue-700 dark:text-blue-300">{fmt(vatPaidDeductible)} ر.س</p>
              </CardContent>
            </Card>
            <Card className={netVatDue >= 0 ? 'border-primary/30' : 'border-green-300 dark:border-green-700'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2"><Scale className="w-4 h-4" /><p className="text-xs font-bold">صافي الضريبة المستحقة للهيئة</p></div>
                <p className={`text-2xl font-black mt-2 ${netVatDue >= 0 ? '' : 'text-green-600 dark:text-green-400'}`}>{fmt(Math.abs(netVatDue))} ر.س</p>
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
                      <Badge className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-[10px]">قابلة للخصم</Badge>
                    ) : (
                      <Badge className="bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[10px]">غير مقبولة</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ═══ مستند 1: تقرير الأداء الإداري (للمدير/المالك) — بدون أي أرقام ضريبية ═══ */}
          <Card className="border-2" style={{ borderColor: '#0f766e' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                📊 تقرير الأداء الإداري — للمدير/المالك
              </CardTitle>
              <p className="text-xs text-muted-foreground">إيرادات، مشتريات، مصروفات، وصافي الربح — مستند داخلي، بدون تفاصيل ضريبية</p>
            </CardHeader>
            <CardContent>
              <div ref={managementStatementRef} className="bg-white text-black p-10" dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif", width: '900px' }}>
                <DocHeader subtitle="تقرير الأداء الإداري (داخلي)" />
                {managementSections.map(renderSection)}
                <p style={{ fontSize: '10px', color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '16px' }}>
                  مستند داخلي لمتابعة أداء المنشأة — لا يُستخدم للتقديم الضريبي الرسمي.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ═══ مستند 2: الإقرار الضريبي الرسمي (لزاتكا) — أرقام ضريبية فقط ═══ */}
          <Card className="border-2" style={{ borderColor: '#1e3a8a' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                📄 الإقرار الضريبي الرسمي — زاتكا
              </CardTitle>
              <p className="text-xs text-muted-foreground">أرقام ضريبة المخرجات والمدخلات والصافي المستحق فقط — أداة مساعدة لتعبئة الإقرار بالبوابة الرسمية</p>
            </CardHeader>
            <CardContent>
              <div ref={taxStatementRef} className="bg-white text-black p-10" dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif", width: '900px' }}>
                <DocHeader subtitle="إقرار ضريبة القيمة المضافة (VAT Return)" />
                {taxSections.map(renderSection)}

                {purchases.filter(p => p.vat_number_valid_format).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-500 mb-2">ملحق — تفاصيل فواتير المشتريات القابلة للخصم</p>
                    <table className="w-full" style={{ fontSize: '11px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr className="border-b-2" style={{ borderColor: '#d1d5db', color: '#6b7280' }}>
                          <th className="py-2 px-3" style={{ textAlign: 'right' }}>التاريخ</th>
                          <th className="py-2 px-3" style={{ textAlign: 'right' }}>المورد</th>
                          <th className="py-2 px-3" style={{ textAlign: 'right' }}>رقم الفاتورة</th>
                          <th className="py-2 px-3" style={{ textAlign: 'left' }}>قيمة الضريبة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.filter(p => p.vat_number_valid_format).map(p => (
                          <tr key={p.id} className="border-b" style={{ borderColor: '#f3f4f6' }}>
                            <td className="py-1.5 px-3 text-gray-500" dir="ltr" style={{ textAlign: 'right' }}>{p.invoice_date}</td>
                            <td className="py-1.5 px-3">{suppliersById[p.supplier_id] || '—'}</td>
                            <td className="py-1.5 px-3" dir="ltr" style={{ textAlign: 'right' }}>{p.invoice_number}</td>
                            <td className="py-1.5 px-3 font-bold" dir="ltr" style={{ textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.vat_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p style={{ fontSize: '10px', color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '16px' }}>
                  هذا الملف أداة مساعدة داخلية لتجميع الأرقام قبل تعبئة الإقرار الضريبي الدوري يدوياً عبر
                  بوابة خدمات زاتكا الإلكترونية (zatca.gov.sa) — وليس مستنداً رسمياً يُرفع أو يُقدَّم لزاتكا مباشرة.
                  يُرجى مراجعة الأرقام مع محاسبكم القانوني قبل التقديم الرسمي.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
