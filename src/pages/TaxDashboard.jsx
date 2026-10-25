/**
 * TaxDashboard — الإقرار الضريبي (ضريبة القيمة المضافة)
 * ─────────────────────────────────────────────────────────────
 * يطابق هيكل نموذج الإقرار في بوابة هيئة الزكاة والضريبة والجمارك:
 *   أ) ضريبة المبيعات: البنود 1–6   ب) ضريبة المشتريات: البنود 7–12
 *   ج) التسوية: البنود 13–16   — بأعمدة: المبلغ | التعديلات | مبلغ الضريبة
 * فواتير المنشأة من المرحلة الأولى (الإصدار) — لا يوجد إبلاغ/ربط، فالإقرار يشمل كل الفواتير الصادرة.
 * الإقرار يُقدَّم يدوياً عبر البوابة (zatca.gov.sa)؛ هذه الصفحة ورقة عمل
 * تحسب كل بند وتُظهر مصدره، مع ملاحق تفصيلية تثبت كل رقم.
 */
import React, { useEffect, useState } from 'react';
import { flushSync, createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { db, APP_SETTINGS_SAFE_COLUMNS } from '@/api/supabaseApi';
import { secureExpenses, secureZatca } from '@/lib/secureApi';
import { getSession } from '@/lib/sessionStore';
import { isFinanceUser } from '@/lib/roles';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  FileSpreadsheet, Printer, ShieldAlert, ShieldCheck, ShoppingBag, RefreshCw, CalendarClock, FileText, BarChart3,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subQuarters, addMonths,
} from 'date-fns';
import { SarSymbol, Sar } from '@/components/shared/SarCurrency';

// أرقام لاتينية دائماً (en-US) حتى تتطابق مع أرقام بوابة الهيئة
const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const VAT_RATE = 0.15;

const PRESETS = {
  thisMonth: () => [startOfMonth(new Date()), endOfMonth(new Date())],
  lastMonth: () => { const d = subMonths(new Date(), 1); return [startOfMonth(d), endOfMonth(d)]; },
  thisQuarter: () => [startOfQuarter(new Date()), endOfQuarter(new Date())],
  lastQuarter: () => { const d = subQuarters(new Date(), 1); return [startOfQuarter(d), endOfQuarter(d)]; },
  thisYear: () => [startOfYear(new Date()), endOfYear(new Date())],
};
const PRESET_LABELS = { thisMonth: 'هذا الشهر', lastMonth: 'الشهر الماضي', thisQuarter: 'هذا الربع', lastQuarter: 'الربع الماضي', thisYear: 'هذه السنة' };

const validVatNumber = (v) => /^3\d{13}3$/.test(String(v || '').trim());
const d10 = (v) => (v ? String(v).slice(0, 10) : '—');

export default function TaxDashboard() {
  const session = getSession();
  const [preset, setPreset] = useState('lastQuarter');
  const [range, setRange] = useState(PRESETS.lastQuarter());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [suppliersById, setSuppliersById] = useState({});
  const [zatcaSettings, setZatcaSettings] = useState(null);
  const [creditNotes, setCreditNotes] = useState([]);
  const [shop, setShop] = useState(null);
  const [corrections, setCorrections] = useState('');   // بند 14
  const [carried, setCarried] = useState('');           // بند 15
  const [preparedAt, setPreparedAt] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);       // 'tax' | 'mgmt'
  const [view, setView] = useState('tax');

  const [start, end] = range;

  const load = async () => {
    setLoading(true);
    const startISO = start.toISOString();
    const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();
    const startDay = format(start, 'yyyy-MM-dd');
    const endDay = format(end, 'yyyy-MM-dd');
    try {
      const [{ data: o }, { data: s }, { data: p }, expensesRaw, { data: sup }, zs, { data: notes }, st] = await Promise.all([
        // طلبات الشركات (partner_id) تُحتسب مرة وحدة عبر فاتورة المبيعات المجمّعة عند السداد
        supabase.from('orders').select('*').is('partner_id', null).gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('sales_invoices').select('*').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('purchase_invoices').select('*').gte('invoice_date', startDay).lte('invoice_date', endDay),
        secureExpenses.list({ orderBy: '-expense_date', limit: 2000, gteCol: 'expense_date', gteVal: startDay, lteCol: 'expense_date', lteVal: endDay }),
        supabase.from('suppliers').select('id,name'),
        secureZatca.getSettings().catch(() => null),
        supabase.from('zatca_credit_debit_notes').select('*').gte('created_at', startISO).lte('created_at', endISO),
        db.AppSettings.list('-created_at', 1, APP_SETTINGS_SAFE_COLUMNS).catch(() => []),
      ]);
      // فواتير المبيعات المجمّعة للشركات تحتوي بنوداً بـ order_id — لا تُحتسب مرتين
      const A = (v) => (Array.isArray(v) ? v : []);
      setOrders(A(o)); setSales(A(s)); setPurchases(A(p));
      setAllExpenses(A(expensesRaw));
      setExpenses(A(expensesRaw).filter((x) => x.is_vat_applicable));
      setSuppliersById(Object.fromEntries(A(sup).map(x => [x.id, x.name])));
      setZatcaSettings(zs || null);
      setCreditNotes(A(notes));
      setShop((Array.isArray(st) && st[0]) || null);
    } catch (e) { toast.error('تعذّر تحميل البيانات: ' + (e.message || '')); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  useEffect(() => {
    const done = () => setPrintDoc(null);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  const applyPreset = (key) => { setPreset(key); setRange(PRESETS[key]()); };
  const setCustomStart = (val) => { if (val) { setPreset('custom'); setRange([new Date(val + 'T00:00:00'), end]); } };
  const setCustomEnd = (val) => { if (val) { setPreset('custom'); setRange([start, new Date(val + 'T00:00:00')]); } };

  if (!session?.role || !isFinanceUser(session.role)) return <Navigate to="/pos" replace />;

  // ═══ الحساب ═══════════════════════════════════════════════
  const isPartnerInv = (inv) => Array.isArray(inv?.items) && inv.items.some(it => it && it.order_id);

  const salesDocs = [
    ...orders.filter(o => o.status !== 'cancelled').map(o => {
      const vat = o.vat_amount != null ? num(o.vat_amount) : null;
      const total = num(o.total_price);
      const net = o.subtotal != null ? num(o.subtotal) : (vat != null ? total - vat : total / (1 + VAT_RATE));
      return { id: 'o' + o.id, kind: 'إصلاح', number: o.order_number, date: o.created_at, net, vat: vat != null ? vat : net * VAT_RATE, status: o.status };
    }),
    ...sales.filter(x => !['cancelled', 'void', 'voided'].includes(x.status)).map(x => {
      const vat = x.vat_amount != null ? num(x.vat_amount) : null;
      const total = num(x.total);
      const net = x.subtotal != null ? num(x.subtotal) : (vat != null ? total - vat : total / (1 + VAT_RATE));
      return { id: 's' + x.id, kind: isPartnerInv(x) ? 'فاتورة شركة' : 'مبيعات', number: x.invoice_number, date: x.created_at, net, vat: vat != null ? vat : net * VAT_RATE, status: 'completed' };
    }),
  ];
  const countedDocs = salesDocs; // المرحلة الأولى: كل الفواتير الصادرة تُحتسب
  const stdDocs = countedDocs.filter(d => r2(d.vat) > 0);
  const zeroDocs = countedDocs.filter(d => r2(d.vat) <= 0);

  // إشعارات الدائن/المدين الصادرة: المبلغ المخزَّن شامل الضريبة → الصافي = المبلغ − الضريبة
  const noteSign = (n) => (n.note_type === 'credit' ? -1 : 1);
  const adjNet = creditNotes.reduce((s, n) => s + noteSign(n) * (num(n.amount) - num(n.vat_amount)), 0);
  const adjVat = creditNotes.reduce((s, n) => s + noteSign(n) * num(n.vat_amount), 0);

  const S1 = { amt: r2(stdDocs.reduce((s, d) => s + d.net, 0)), adj: r2(adjNet), vat: r2(stdDocs.reduce((s, d) => s + d.vat, 0) + adjVat) };
  const S3 = { amt: r2(zeroDocs.reduce((s, d) => s + d.net, 0)), adj: 0, vat: 0 };
  const Z = { amt: 0, adj: 0, vat: 0 };
  const salesTotal = { amt: r2(S1.amt + S3.amt), adj: r2(S1.adj + S3.adj), vat: r2(S1.vat + S3.vat) };

  // المشتريات: فقط فواتير الموردين ذوي الرقم الضريبي الصالح + المصروفات التي عليها فاتورة ضريبية رسمية
  const validPurchases = purchases.filter(p => p.vat_number_valid_format);
  const invalidPurchases = purchases.filter(p => !p.vat_number_valid_format);
  const deductibleExpenses = expenses.filter(e => e.has_tax_invoice);
  const nonDeductibleExpenses = expenses.filter(e => !e.has_tax_invoice);
  const purchDocs = [
    ...validPurchases.map(p => ({ id: 'p' + p.id, kind: 'فاتورة شراء', party: suppliersById[p.supplier_id] || '—', number: p.invoice_number, date: p.invoice_date, net: num(p.taxable_amount), vat: num(p.vat_amount) })),
    ...deductibleExpenses.map(e => ({ id: 'e' + e.id, kind: 'مصروف', party: e.supplier_vat_number || e.description || '—', number: e.description || '—', date: e.expense_date, net: e.subtotal != null ? num(e.subtotal) : num(e.amount) - num(e.vat_amount), vat: num(e.vat_amount) })),
  ];
  const P7 = { amt: r2(purchDocs.filter(d => r2(d.vat) > 0).reduce((s, d) => s + d.net, 0)), adj: 0, vat: r2(purchDocs.reduce((s, d) => s + d.vat, 0)) };
  const P10 = { amt: r2(purchDocs.filter(d => r2(d.vat) <= 0).reduce((s, d) => s + d.net, 0)), adj: 0, vat: 0 };
  const purchTotal = { amt: r2(P7.amt + P10.amt), adj: 0, vat: P7.vat };

  const box13 = r2(salesTotal.vat - purchTotal.vat);
  const box14 = num(corrections);
  const box15 = num(carried);
  const box16 = r2(box13 + box14 - box15);
  const dueDate = endOfMonth(addMonths(end, 1));

  const vatNo = zatcaSettings?.vat_number || shop?.vat_number || '';
  const crNo = zatcaSettings?.cr_number || shop?.cr_number || '';
  const sellerName = zatcaSettings?.seller_name || shop?.shop_name || 'إبرة وخيط الإسكافي';
  const addrParts = [zatcaSettings?.building_number, zatcaSettings?.street, zatcaSettings?.district, zatcaSettings?.city || shop?.city, zatcaSettings?.postal_code].filter(Boolean);
  const address = addrParts.length ? addrParts.join('، ') : (shop?.address || '');
  const periodDays = Math.round((end - start) / 86400000) + 1;
  const isMonth = start.getDate() === 1 && end.getTime() === endOfMonth(start).getTime() && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const isQuarter = start.getTime() === startOfQuarter(start).getTime() && end.getTime() === endOfQuarter(start).getTime();
  const periodKind = isMonth ? 'شهرية · Monthly' : isQuarter ? 'ربع سنوية · Quarterly' : 'فترة مخصّصة · Custom';

  const expensesByCategory = (() => {
    const m = {};
    allExpenses.forEach(e => { const c = e.category || 'أخرى'; m[c] = (m[c] || 0) + num(e.subtotal ?? e.amount); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  })();
  const revenueNet = salesDocs.reduce((s, d) => s + d.net, 0) + adjNet;
  const purchasesNet = purchases.reduce((s, p) => s + num(p.taxable_amount), 0);
  const expensesNet = allExpenses.reduce((s, e) => s + num(e.subtotal ?? e.amount), 0);
  const netProfit = revenueNet - purchasesNet - expensesNet;

  // ═══ فحوصات الجاهزية ═══
  const checks = [
    { ok: validVatNumber(vatNo), label: 'الرقم الضريبي صالح (15 رقماً، يبدأ وينتهي بـ 3)', hint: vatNo || 'غير مضبوط — أضفه من صفحة زاتكا' },
    { ok: !!crNo, label: 'رقم السجل التجاري مسجَّل', hint: crNo || 'غير مضبوط' },
    { ok: !!address, label: 'العنوان الوطني مكتمل', hint: address || 'غير مضبوط' },
    { ok: isMonth || isQuarter, label: 'الفترة تطابق شهراً أو ربعاً سنوياً كاملاً', hint: `${format(start, 'yyyy-MM-dd')} → ${format(end, 'yyyy-MM-dd')} (${periodDays} يوماً)` },
    { ok: zeroDocs.length === 0, warn: true, label: 'لا توجد مبيعات بدون ضريبة', hint: zeroDocs.length ? `${zeroDocs.length} عملية ضريبتها صفر وأُدرجت في البند 3 (نسبة الصفر) — راجعها` : 'لا يوجد' },
    { ok: invalidPurchases.length === 0 && nonDeductibleExpenses.length === 0, warn: true, label: 'كل المشتريات والمصروفات قابلة لخصم الضريبة', hint: (invalidPurchases.length + nonDeductibleExpenses.length) ? `${invalidPurchases.length} فاتورة شراء (مورد بلا رقم ضريبي صالح) و${nonDeductibleExpenses.length} مصروف بلا فاتورة ضريبية — مستبعدة` : 'لا يوجد' },
    { ok: Math.abs(box14) < 5000, label: 'التصحيحات من الفترات السابقة أقل من 5,000 ريال (الحد النظامي)', hint: box14 ? fmt(box14) : 'لا يوجد' },
  ];
  const hardFail = checks.filter(c => !c.ok && !c.warn).length;

  const doPrint = (which) => {
    flushSync(() => { setPreparedAt(new Date()); setPrintDoc(which); });
    setTimeout(() => window.print(), 60);
  };

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


  // ═══ المستندات ═══
  const Money = ({ v, neg }) => <span dir="ltr" className={v < 0 || neg ? 'neg' : ''}>{v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v)}</span>;

  const FormRow = ({ no, ar, en, c, total, vatOnly, strong }) => (
    <tr className={`${total ? 'tot' : ''} ${strong ? 'strong' : ''}`}>
      <td className="no">{no}</td>
      <td className="lb">{ar}<i>{en}</i></td>
      {vatOnly ? (<><td className="n na" colSpan={2}></td><td className="n"><Money v={c.vat} /></td></>) : (
        <><td className="n"><Money v={c.amt} /></td><td className="n"><Money v={c.adj} /></td><td className="n"><Money v={c.vat} /></td></>
      )}
    </tr>
  );

  const taxDoc = (
    <div className="vr" dir="rtl">
      <div className="vr-h">
        <div className="vr-brand">
          <img src="/images/cobblers-official-mark.png" alt="" />
          <div><b>{sellerName}</b><span>إقرار ضريبة القيمة المضافة · VAT Return</span></div>
        </div>
        <div className="vr-ttl">
          <small>المملكة العربية السعودية · هيئة الزكاة والضريبة والجمارك</small>
          <h2>الإقرار الضريبي</h2>
          <small className="en">Value Added Tax Return — ZATCA</small>
        </div>
      </div>

      <table className="vr-info">
        <tbody>
          <tr><th>الرقم الضريبي<i>VAT Registration No.</i></th><td dir="ltr">{vatNo || '—'}</td><th>اسم المنشأة<i>Taxpayer name</i></th><td>{sellerName}</td></tr>
          <tr><th>السجل التجاري<i>CR No.</i></th><td dir="ltr">{crNo || '—'}</td><th>العنوان<i>Address</i></th><td>{address || '—'}</td></tr>
          <tr><th>الفترة الضريبية<i>Tax period</i></th><td dir="ltr">{format(start, 'yyyy-MM-dd')} → {format(end, 'yyyy-MM-dd')}</td><th>دورية التقديم<i>Filing frequency</i></th><td>{periodKind}</td></tr>
          <tr><th>آخر موعد للتقديم والسداد<i>Due date</i></th><td dir="ltr">{format(dueDate, 'yyyy-MM-dd')}</td><th>تاريخ ووقت الإعداد<i>Prepared at</i></th><td dir="ltr">{format(preparedAt || new Date(), 'yyyy-MM-dd HH:mm:ss')}</td></tr>
        </tbody>
      </table>

      <table className="vr-t">
        <thead>
          <tr><th className="no">#</th><th className="lb">البند<i>Description</i></th><th className="n">المبلغ<i>Amount (SAR)</i></th><th className="n">التعديلات<i>Adjustment (SAR)</i></th><th className="n">مبلغ الضريبة<i>VAT Amount (SAR)</i></th></tr>
        </thead>
        <tbody>
          <tr className="sec"><td colSpan={5}>أولاً — ضريبة القيمة المضافة على المبيعات · VAT on Sales</td></tr>
          <FormRow no="1" ar="المبيعات الخاضعة للنسبة الأساسية (15%)" en="Standard rated sales" c={S1} />
          <FormRow no="2" ar="مبيعات الخدمات الصحية الخاصة / التعليم الأهلي / أول مسكن للمواطنين" en="Private healthcare / private education / first house sales to citizens" c={Z} />
          <FormRow no="3" ar="المبيعات المحلية الخاضعة لنسبة الصفر" en="Zero-rated domestic sales" c={S3} />
          <FormRow no="4" ar="الصادرات" en="Exports" c={Z} />
          <FormRow no="5" ar="المبيعات المعفاة" en="Exempt sales" c={Z} />
          <FormRow no="6" ar="إجمالي المبيعات" en="Total sales" c={salesTotal} total />
          <tr className="sec"><td colSpan={5}>ثانياً — ضريبة القيمة المضافة على المشتريات · VAT on Purchases</td></tr>
          <FormRow no="7" ar="المشتريات المحلية الخاضعة للنسبة الأساسية" en="Standard rated domestic purchases" c={P7} />
          <FormRow no="8" ar="الواردات الخاضعة للضريبة والمسددة في الجمارك" en="Imports subject to VAT paid at customs" c={Z} />
          <FormRow no="9" ar="الواردات الخاضعة للضريبة بآلية الاحتساب العكسي" en="Imports subject to VAT accounted for through reverse charge" c={Z} />
          <FormRow no="10" ar="المشتريات الخاضعة لنسبة الصفر" en="Zero-rated purchases" c={P10} />
          <FormRow no="11" ar="المشتريات المعفاة" en="Exempt purchases" c={Z} />
          <FormRow no="12" ar="إجمالي المشتريات" en="Total purchases" c={purchTotal} total />
          <tr className="sec"><td colSpan={5}>ثالثاً — ملخص الضريبة · Net VAT</td></tr>
          <FormRow no="13" ar="إجمالي ضريبة القيمة المضافة المستحقة عن الفترة الحالية" en="Total VAT due for current period (6 − 12)" c={{ vat: box13 }} vatOnly />
          <FormRow no="14" ar="التصحيحات من الفترات السابقة (أقل من 5,000 ريال)" en="Corrections from previous period (less than SAR 5,000)" c={{ vat: box14 }} vatOnly />
          <FormRow no="15" ar="الضريبة المرحّلة من الفترة/الفترات السابقة" en="VAT credit carried forward from previous period(s)" c={{ vat: box15 }} vatOnly />
          <FormRow no="16" ar={box16 >= 0 ? 'صافي الضريبة المستحقة للسداد' : 'صافي الضريبة المستردّة / المرحّلة'} en="Net VAT due (or reclaimed) = 13 + 14 − 15" c={{ vat: box16 }} vatOnly total strong />
        </tbody>
      </table>
      <p className="vr-note">البند 13 = ضريبة المبيعات (6) − ضريبة المشتريات (12). المبالغ بالريال السعودي (<SarSymbol />). الأرقام بين أقواس سالبة (إشعارات دائنة / رصيد لصالح المنشأة).</p>

      <div className="vr-sign">
        <div><b>إقرار مقدّم الإقرار</b><p>أقرّ بأن المعلومات الواردة في هذا الإقرار صحيحة وكاملة وفق أنظمة ضريبة القيمة المضافة في المملكة العربية السعودية.</p></div>
        <div className="box"><span>الاسم والصفة</span><span>التوقيع والختم</span><span>التاريخ</span></div>
      </div>

      <div className="vr-pb" />
      <h3 className="vr-h3">ملحق (أ) — مبيعات الفترة · Annex A: Sales ({countedDocs.length})</h3>
      <table className="vr-t sm">
        <thead><tr><th>#</th><th className="lb">رقم المستند</th><th className="lb">النوع</th><th className="lb">التاريخ</th><th className="n">الصافي</th><th className="n">الضريبة</th><th className="lb">الحالة</th></tr></thead>
        <tbody>
          {countedDocs.length === 0 && <tr><td colSpan={7} className="empty">لا توجد مبيعات في هذه الفترة</td></tr>}
          {countedDocs.map((d, i) => (
            <tr key={d.id}><td className="no">{i + 1}</td><td dir="ltr" className="lb">{d.number}</td><td className="lb">{d.kind}</td><td dir="ltr" className="lb">{d10(d.date)}</td><td className="n"><Money v={d.net} /></td><td className="n"><Money v={d.vat} /></td><td className="lb">{d.status === 'completed' ? 'مكتمل' : 'صادرة'}</td></tr>
          ))}
          {creditNotes.map(n => (
            <tr key={n.id} className="cn"><td className="no">—</td><td dir="ltr" className="lb">{n.note_number}</td><td className="lb">{n.note_type === 'credit' ? 'إشعار دائن' : 'إشعار مدين'}</td><td dir="ltr" className="lb">{d10(n.created_at)}</td><td className="n"><Money v={noteSign(n) * (num(n.amount) - num(n.vat_amount))} /></td><td className="n"><Money v={noteSign(n) * num(n.vat_amount)} /></td><td className="lb">صادر</td></tr>
          ))}
        </tbody>
      </table>

      <h3 className="vr-h3">ملحق (ب) — المشتريات والمصروفات المخصومة · Annex B: Deductible purchases ({purchDocs.length})</h3>
      <table className="vr-t sm">
        <thead><tr><th>#</th><th className="lb">المورد / البيان</th><th className="lb">النوع</th><th className="lb">رقم الفاتورة</th><th className="lb">التاريخ</th><th className="n">الصافي</th><th className="n">الضريبة</th></tr></thead>
        <tbody>
          {purchDocs.length === 0 && <tr><td colSpan={7} className="empty">لا توجد مشتريات قابلة للخصم في هذه الفترة</td></tr>}
          {purchDocs.map((d, i) => (
            <tr key={d.id}><td className="no">{i + 1}</td><td className="lb">{d.party}</td><td className="lb">{d.kind}</td><td dir="ltr" className="lb">{d.number}</td><td dir="ltr" className="lb">{d10(d.date)}</td><td className="n"><Money v={d.net} /></td><td className="n"><Money v={d.vat} /></td></tr>
          ))}
        </tbody>
      </table>

      {(invalidPurchases.length > 0 || nonDeductibleExpenses.length > 0) && (
        <>
          <h3 className="vr-h3">ملحق (ج) — مستبعد من الخصم · Annex C: Excluded</h3>
          <table className="vr-t sm">
            <thead><tr><th>#</th><th className="lb">البيان</th><th className="lb">السبب</th><th className="n">الضريبة غير المخصومة</th></tr></thead>
            <tbody>
              {invalidPurchases.map((p, i) => (<tr key={p.id}><td className="no">{i + 1}</td><td className="lb">{suppliersById[p.supplier_id] || '—'} — {p.invoice_number}</td><td className="lb">مورد بلا رقم ضريبي صالح</td><td className="n"><Money v={num(p.vat_amount)} /></td></tr>))}
              {nonDeductibleExpenses.map((e, i) => (<tr key={e.id}><td className="no">{invalidPurchases.length + i + 1}</td><td className="lb">{e.description || e.category || '—'} — {d10(e.expense_date)}</td><td className="lb">لا توجد فاتورة ضريبية</td><td className="n"><Money v={num(e.vat_amount)} /></td></tr>))}
            </tbody>
          </table>
        </>
      )}

      <div className="vr-ft">
        <span>أُعدّ آلياً من بيانات النظام — ورقة عمل لتعبئة الإقرار في بوابة الهيئة (zatca.gov.sa)</span>
        <span dir="ltr">{vatNo} · {format(preparedAt || new Date(), 'yyyy-MM-dd HH:mm:ss')}</span>
      </div>
    </div>
  );

  const mgmtDoc = (
    <div className="vr" dir="rtl">
      <div className="vr-h">
        <div className="vr-brand"><img src="/images/cobblers-official-mark.png" alt="" /><div><b>{sellerName}</b><span>مستند داخلي — غير مخصّص للتقديم الضريبي</span></div></div>
        <div className="vr-ttl"><small>Management Performance Report</small><h2>تقرير الأداء الإداري</h2><small className="en" dir="ltr">{format(start, 'yyyy-MM-dd')} → {format(end, 'yyyy-MM-dd')}</small></div>
      </div>
      <table className="vr-t">
        <thead><tr><th className="lb" colSpan={2}>البند<i>Description</i></th><th className="n">المبلغ<i>SAR (ex. VAT)</i></th></tr></thead>
        <tbody>
          <tr className="sec"><td colSpan={3}>الإيرادات · Revenue</td></tr>
          <tr><td className="lb" colSpan={2}>صافي المبيعات (بعد إشعارات الدائن)</td><td className="n"><Money v={r2(revenueNet)} /></td></tr>
          <tr className="sec"><td colSpan={3}>التكاليف · Costs</td></tr>
          <tr><td className="lb" colSpan={2}>المشتريات ({purchases.length} فاتورة)</td><td className="n"><Money v={-purchasesNet} /></td></tr>
          {expensesByCategory.map(([c, v]) => (<tr key={c}><td className="lb" colSpan={2}>مصروفات — {c}</td><td className="n"><Money v={-v} /></td></tr>))}
          <tr className="tot strong"><td className="lb" colSpan={2}>{netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة'}<i>هامش {revenueNet > 0 ? ((netProfit / revenueNet) * 100).toFixed(1) : '0.0'}%</i></td><td className="n"><Money v={r2(netProfit)} /></td></tr>
        </tbody>
      </table>
      <div className="vr-ft"><span>مستند داخلي لمتابعة الأداء</span><span dir="ltr">{format(preparedAt || new Date(), 'yyyy-MM-dd HH:mm:ss')}</span></div>
    </div>
  );

  const css = `
    .vr{font-family:'IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif;color:#111827;background:#fff;font-size:12px;padding:34px 38px;border-radius:14px;line-height:1.5}
    .vr *{font-variant-numeric:tabular-nums}
    .vr i{display:block;font-style:normal;font-weight:400;color:#6b7280;font-size:9.5px}
    .vr-h{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid #111827}
    .vr-brand{display:flex;gap:14px;align-items:center}.vr-brand img{height:54px;width:auto;filter:brightness(0)}
    .vr-brand b{font-size:16px;display:block}.vr-brand span{color:#6b7280;font-size:10.5px}
    .vr-ttl{text-align:left}.vr-ttl small{font-size:10px;color:#6b7280;display:block}.vr-ttl h2{font-size:25px;font-weight:700;margin:2px 0}
    .vr-info{width:100%;border-collapse:collapse;margin:14px 0;border:1px solid #111827}
    .vr-info th{background:#f3f4f6;text-align:right;font-size:10.5px;font-weight:600;padding:7px 10px;width:17%;border:1px solid #d1d5db}
    .vr-info td{padding:7px 10px;border:1px solid #d1d5db;font-size:11.5px;width:33%}
    .vr-t{width:100%;border-collapse:collapse;margin-top:6px}
    .vr-t th{background:#f3f4f6;font-size:10.5px;font-weight:600;padding:8px 9px;border-top:1px solid #111827;border-bottom:1px solid #111827;text-align:right}
    .vr-t th.n,.vr-t td.n{text-align:left}.vr-t td{padding:8px 9px;border-bottom:1px solid #e5e7eb;font-size:11.5px;vertical-align:top}
    .vr-t .no{width:34px;text-align:center;color:#6b7280}.vr-t .lb{text-align:right}.vr-t .n{width:130px;white-space:nowrap}
    .vr-t td.na{background:#f9fafb}
    .vr-t tr.sec td{background:#111827;color:#fff;font-weight:600;font-size:11.5px;padding:7px 10px}
    .vr-t tr.tot td{font-weight:700;background:#f9fafb;border-top:1px solid #111827;border-bottom:1px solid #111827}
    .vr-t tr.strong td{background:#eef2ff;font-size:13px;border-top:2px solid #111827;border-bottom:2px solid #111827}
    .vr-t.sm td,.vr-t.sm th{font-size:10px;padding:5px 7px}.vr-t tr.cn td{color:#b42318}.vr-t .empty{text-align:center;color:#6b7280;padding:14px}
    .vr .neg{color:#b42318}
    .vr-note{font-size:10px;color:#6b7280;margin:8px 0 0}
    .vr-sign{display:grid;grid-template-columns:1.2fr 1fr;gap:20px;margin-top:22px;border:1px solid #d1d5db;padding:12px 14px}
    .vr-sign b{font-size:11.5px}.vr-sign p{font-size:10px;color:#6b7280;margin:4px 0 0}
    .vr-sign .box{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:end;min-height:64px}
    .vr-sign .box span{border-top:1px solid #111827;padding-top:4px;font-size:9.5px;color:#6b7280;text-align:center}
    .vr-h3{font-size:12.5px;font-weight:700;margin:22px 0 4px}
    .vr-ft{display:flex;justify-content:space-between;margin-top:22px;padding-top:9px;border-top:1px solid #d1d5db;font-size:9.5px;color:#6b7280}
    .vr-pb{break-after:page;height:1px}
    @media print{
      @page{size:A4;margin:10mm}
      #root{display:none!important}
      #tax-print{display:block!important}
      .vr{padding:0;border-radius:0}.vr tr{break-inside:avoid}
      .vr *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
  `;

  const kpi = (label, en, value, tone, sub) => (
    <div className="bg-card p-5">
      <div className="flex items-center justify-between"><p className="text-[13px] text-muted-foreground font-medium">{label}<span className="block text-[10.5px] opacity-70">{en}</span></p><span className={`ios-tile ${tone}`}><FileText className="w-[16px] h-[16px]" /></span></div>
      <p className="text-[28px] leading-none font-semibold mt-3 mb-1.5 tracking-tight tnum"><Sar>{fmt(value)}</Sar></p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );

  return (
    <div className="space-y-5" dir="rtl">
      <style>{css}</style>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="ios-tile ios-tile-lg tone-indigo"><FileText className="w-5 h-5" /></span>
          <div>
            <h1 className="text-xl font-black">الإقرار الضريبي</h1>
            <p className="text-sm text-muted-foreground">إقرار ضريبة القيمة المضافة بصيغة نموذج هيئة الزكاة والضريبة والجمارك</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Link to="/purchasing"><Button variant="outline"><ShoppingBag className="w-4 h-4 ml-1" /> المشتريات</Button></Link>
          <Button onClick={load} variant="ghost" size="icon" aria-label="تحديث"><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={exportReturn} disabled={exporting} variant="outline"><FileSpreadsheet className="w-4 h-4 ml-1" />{exporting ? 'جارِ الإنشاء...' : 'Excel'}</Button>
          <Button onClick={() => doPrint(view)} disabled={loading}><Printer className="w-4 h-4 ml-1" /> طباعة / PDF</Button>
        </div>
      </div>

      <div className="bg-card p-4 space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          {Object.keys(PRESETS).map(key => (
            <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'} className="rounded-full" onClick={() => applyPreset(key)}>{PRESET_LABELS[key]}</Button>
          ))}
          <div className="flex items-center gap-2 border-r pr-3 mr-1">
            <Label htmlFor="tax-from" className="text-xs text-muted-foreground">من</Label>
            <Input id="tax-from" type="date" className="h-8 w-[150px] text-xs" value={format(start, 'yyyy-MM-dd')} onChange={e => setCustomStart(e.target.value)} />
            <Label htmlFor="tax-to" className="text-xs text-muted-foreground">إلى</Label>
            <Input id="tax-to" type="date" className="h-8 w-[150px] text-xs" value={format(end, 'yyyy-MM-dd')} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-4 flex-wrap items-end text-xs">
          <div><Label className="text-muted-foreground">بند 14 — تصحيحات سابقة (±)</Label><Input type="number" step="0.01" className="h-8 w-40 mt-1" value={corrections} onChange={e => setCorrections(e.target.value)} placeholder="0.00" /></div>
          <div><Label className="text-muted-foreground">بند 15 — ضريبة مرحّلة (رصيد دائن)</Label><Input type="number" step="0.01" className="h-8 w-40 mt-1" value={carried} onChange={e => setCarried(e.target.value)} placeholder="0.00" /></div>
          <p className="text-muted-foreground flex items-center gap-1.5 pb-1"><CalendarClock className="w-4 h-4" /> آخر موعد للتقديم والسداد: <b className="text-foreground" dir="ltr">{format(dueDate, 'yyyy-MM-dd')}</b></p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {kpi('ضريبة المبيعات', 'Output VAT (box 6)', salesTotal.vat, 'tone-green', `${countedDocs.length} فاتورة${creditNotes.length ? ` · ${creditNotes.length} إشعار` : ''}`)}
            {kpi('ضريبة المشتريات', 'Input VAT (box 12)', purchTotal.vat, 'tone-blue', `${purchDocs.length} مستند قابل للخصم`)}
            {kpi(box16 >= 0 ? 'صافي المستحق للسداد' : 'صافي مسترد / مرحّل', 'Net VAT (box 16)', Math.abs(box16), box16 >= 0 ? 'tone-orange' : 'tone-teal', box16 >= 0 ? 'يُسدَّد عبر سداد قبل الموعد' : 'رصيد لصالح المنشأة')}
          </div>

          <div className="bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              {hardFail ? <ShieldAlert className="w-5 h-5 text-destructive" /> : <ShieldCheck className="w-5 h-5" style={{ color: '#30d158' }} />}
              <h2 className="font-bold text-sm">فحص جاهزية الإقرار {hardFail ? `— ${hardFail} بند يحتاج إصلاحاً قبل التقديم` : '— البيانات الأساسية مكتملة'}</h2>
            </div>
            <ul className="grid md:grid-cols-2 gap-x-6 gap-y-2">
              {checks.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${c.ok ? 'bg-green-500' : c.warn ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span><b className="font-medium">{c.label}</b><span className="block text-xs text-muted-foreground">{c.hint}</span></span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant={view === 'tax' ? 'default' : 'outline'} className="rounded-full" onClick={() => setView('tax')}><FileText className="w-4 h-4 ml-1" /> الإقرار الضريبي</Button>
            <Button size="sm" variant={view === 'mgmt' ? 'default' : 'outline'} className="rounded-full" onClick={() => setView('mgmt')}><BarChart3 className="w-4 h-4 ml-1" /> تقرير الأداء الإداري (داخلي)</Button>
          </div>
          <div className="overflow-x-auto pb-2"><div style={{ minWidth: 760 }}>{view === 'tax' ? taxDoc : mgmtDoc}</div></div>
          <p className="text-xs text-muted-foreground">الإقرار يُقدَّم عبر بوابة الهيئة (zatca.gov.sa) بنقل أرقام البنود 1–16 كما هي. راجع الأرقام مع محاسبك القانوني قبل التقديم.</p>
        </>
      )}
      {typeof document !== 'undefined' && createPortal(<div id="tax-print" style={{ display: 'none' }}>{printDoc === 'mgmt' ? mgmtDoc : printDoc === 'tax' ? taxDoc : null}</div>, document.body)}
    </div>
  );
}
