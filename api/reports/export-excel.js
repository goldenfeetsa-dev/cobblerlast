/**
 * POST /api/reports/export-excel
 * body: { start: ISOString, end: ISOString }
 * Returns a styled .xlsx file — Summary / Revenue / Expenses / Tax
 * sheets, formatted like a real accounting export (bold headers,
 * colored totals, currency formatting, frozen header rows).
 */
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CATEGORY_AR = {
  rent: 'إيجار', salaries: 'رواتب', utilities: 'فواتير خدمات',
  supplies: 'مستلزمات', maintenance: 'صيانة', marketing: 'تسويق', other: 'أخرى',
};

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin' } };
  });
  row.height = 22;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط' });

  const { start, end } = req.body || {};
  if (!start || !end) return res.status(400).json({ error: 'start و end مطلوبين' });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const startDay = start.slice(0, 10);
  const endDay = end.slice(0, 10);

  const [{ data: orders }, { data: sales }, { data: expenses }, { data: purchases }, { data: settings }] = await Promise.all([
    supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end),
    supabase.from('sales_invoices').select('*').gte('created_at', start).lte('created_at', end),
    supabase.from('expenses').select('*').gte('expense_date', startDay).lte('expense_date', endDay),
    supabase.from('purchase_invoices').select('*, suppliers(name)').gte('invoice_date', startDay).lte('invoice_date', endDay),
    supabase.from('zatca_settings').select('seller_name, vat_number, cr_number').eq('id', 1).single(),
  ]);

  const repairRevenue = (orders || []).reduce((s, o) => s + (o.subtotal ?? (o.total_price || 0) / 1.15), 0);
  const productRevenue = (sales || []).reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const totalRevenue = repairRevenue + productRevenue;
  const totalExpenses = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const reported = [...(orders || []).filter(o => o.zatca_status === 'REPORTED'), ...(sales || []).filter(s => s.zatca_status === 'REPORTED')];
  const vatCollected = reported.reduce((s, r) => s + (r.subtotal ?? (r.total_price || 0) / 1.15) * 0.15, 0);

  // ضريبة المدخلات (المشتريات) — فقط الفواتير التي لدى موردها رقم ضريبي بصيغة صحيحة تُحتسب "قابلة للخصم"
  const validPurchases = (purchases || []).filter(p => p.vat_number_valid_format);
  const invalidPurchases = (purchases || []).filter(p => !p.vat_number_valid_format);
  const vatPaidPurchases = validPurchases.reduce((s, p) => s + (Number(p.vat_amount) || 0), 0);
  const vatPaidExcluded = invalidPurchases.reduce((s, p) => s + (Number(p.vat_amount) || 0), 0);
  // ضريبة المصروفات القابلة للخصم (إيجار، كهرباء... مصروفات مسجّلة شاملة ضريبة)
  const vatPaidExpenses = (expenses || []).filter(e => e.is_vat_applicable).reduce((s, e) => s + (Number(e.vat_amount) || 0), 0);
  const vatPaidDeductible = vatPaidPurchases + vatPaidExpenses;
  const netVatDue = vatCollected - vatPaidDeductible;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cobblerlast';
  wb.created = new Date();

  // ══════════════════════════════════════════════════════════
  // ── الإقرار الضريبي (VAT Return) — الشيت الأول والأهم ──
  // مصمم على شكل نموذج جاهز لنقل أرقامه مباشرة لبوابة زاتكا
  // (fatoora.zatca.gov.sa) عند تعبئة الإقرار الدوري.
  // ══════════════════════════════════════════════════════════
  const ret = wb.addWorksheet('الإقرار الضريبي', { views: [{ rightToLeft: true }] });
  ret.columns = [{ width: 46 }, { width: 22 }];

  const titleRow = ret.addRow(['إقرار ضريبة القيمة المضافة (VAT Return)', '']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FF1E3A8A' } };
  ret.addRow([]);

  // ── بيانات المنشأة ──
  const bizRows = [
    ['اسم المنشأة', settings?.seller_name || '—'],
    ['الرقم الضريبي (VAT Number)', settings?.vat_number || '⚠️ غير مضبوط بإعدادات زاتكا'],
    ['رقم السجل التجاري (CR)', settings?.cr_number || '—'],
    ['الفترة الضريبية', `${startDay} إلى ${endDay}`],
    ['تاريخ إعداد الملف', new Date().toISOString().slice(0, 10)],
  ];
  bizRows.forEach(([label, val]) => {
    const r = ret.addRow([label, val]);
    r.getCell(1).font = { bold: true };
    if (label.includes('الرقم الضريبي') && (!settings?.vat_number)) r.getCell(2).font = { color: { argb: 'FFDC2626' }, bold: true };
  });
  ret.addRow([]);

  // ── القسم الأول: ضريبة المخرجات (المبيعات) ──
  const s1 = ret.addRow(['القسم الأول — ضريبة المخرجات (المبيعات)', '']);
  s1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  s1.getCell(1).fill = s1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
  const outputRows = [
    ['المبيعات الخاضعة للنسبة الأساسية (15%) — صافي المبلغ', totalRevenue],
    ['ضريبة القيمة المضافة المستحقة على المبيعات (ضريبة المخرجات)', vatCollected],
  ];
  outputRows.forEach(([label, val]) => {
    const r = ret.addRow([label, Number(val.toFixed(2))]);
    r.getCell(2).numFmt = '#,##0.00';
  });
  ret.addRow([]);

  // ── القسم الثاني: ضريبة المدخلات (المشتريات) ──
  const s2 = ret.addRow(['القسم الثاني — ضريبة المدخلات (المشتريات)', '']);
  s2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  s2.getCell(1).fill = s2.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  const inputRows = [
    ['المشتريات الخاضعة القابلة للخصم — صافي المبلغ', validPurchases.reduce((s, p) => s + (Number(p.taxable_amount) || 0), 0)],
    ['   منها: ضريبة فواتير المشتريات (وحدة المشتريات)', vatPaidPurchases],
    ['   منها: ضريبة المصروفات المسجّلة الشاملة للضريبة (رواتب، إيجار...)', vatPaidExpenses],
    ['ضريبة القيمة المضافة القابلة للخصم (ضريبة المدخلات) — الإجمالي', vatPaidDeductible],
  ];
  inputRows.forEach(([label, val]) => {
    const r = ret.addRow([label, Number(val.toFixed(2))]);
    r.getCell(2).numFmt = '#,##0.00';
  });
  ret.addRow([]);

  // ── القسم الثالث: الصافي ──
  const s3 = ret.addRow(['القسم الثالث — صافي الضريبة', '']);
  s3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  s3.getCell(1).fill = s3.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  const netRow = ret.addRow([
    netVatDue >= 0 ? 'صافي الضريبة المستحقة على المنشأة (تُسدَّد للهيئة)' : 'صافي الرصيد الضريبي لصالح المنشأة (استرداد/ترحيل)',
    Number(Math.abs(netVatDue).toFixed(2)),
  ]);
  netRow.font = { bold: true, size: 13 };
  netRow.getCell(2).numFmt = '#,##0.00';
  netRow.getCell(2).font = { bold: true, size: 13, color: { argb: netVatDue >= 0 ? 'FFDC2626' : 'FF16A34A' } };
  ret.addRow([]);

  const noteRow = ret.addRow(['هذا الملف مساعد لتعبئة الإقرار ببوابة فاتورة (fatoora.zatca.gov.sa) — راجع الأرقام مع محاسبك القانوني قبل التقديم الرسمي.', '']);
  noteRow.font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };

  // ── Summary sheet ──
  const summary = wb.addWorksheet('الملخص', { views: [{ rightToLeft: true }] });
  summary.columns = [{ width: 28 }, { width: 20 }];
  summary.addRow(['كشف حساب مالي', '']).font = { bold: true, size: 16 };
  summary.addRow([`الفترة: ${startDay} إلى ${endDay}`, '']);
  summary.addRow([]);
  const sumHeader = summary.addRow(['البند', 'المبلغ (ر.س)']);
  styleHeaderRow(sumHeader);
  const rows = [
    ['إيراد الإصلاح', repairRevenue],
    ['إيراد المنتجات', productRevenue],
    ['إجمالي الإيراد', totalRevenue],
    ['إجمالي المصاريف', totalExpenses],
    ['صافي الربح', netProfit],
    ['ضريبة القيمة المضافة المُحصّلة على المبيعات (ضريبة المخرجات)', vatCollected],
    ['ضريبة القيمة المضافة على المشتريات القابلة للخصم (ضريبة المدخلات)', vatPaidDeductible],
    ['ضريبة مشتريات مستبعدة (مورد بدون رقم ضريبي صالح)', vatPaidExcluded],
    ['صافي الضريبة المستحقة للهيئة (المخرجات − المدخلات)', netVatDue],
  ];
  rows.forEach(([label, val], i) => {
    const r = summary.addRow([label, Number(val.toFixed(2))]);
    r.getCell(2).numFmt = '#,##0.00';
    if (label === 'إجمالي الإيراد' || label === 'صافي الربح') {
      r.font = { bold: true };
      r.getCell(2).font = { bold: true, color: { argb: label === 'صافي الربح' ? (netProfit >= 0 ? 'FF16A34A' : 'FFDC2626') : 'FF16A34A' } };
    }
    if (label.startsWith('صافي الضريبة المستحقة')) {
      r.font = { bold: true };
      r.getCell(2).font = { bold: true, color: { argb: 'FF1E3A8A' } };
    }
  });

  // ── Revenue detail ──
  const revSheet = wb.addWorksheet('تفاصيل الإيراد', { views: [{ rightToLeft: true }] });
  revSheet.columns = [{ width: 14 }, { width: 16 }, { width: 24 }, { width: 16 }, { width: 14 }];
  styleHeaderRow(revSheet.addRow(['التاريخ', 'النوع', 'الرقم', 'العميل', 'المبلغ']));
  (orders || []).forEach(o => {
    const r = revSheet.addRow([o.created_at?.slice(0, 10), 'إصلاح', o.order_number, o.customer_name, Number((o.subtotal ?? (o.total_price || 0) / 1.15).toFixed(2))]);
    r.getCell(5).numFmt = '#,##0.00';
  });
  (sales || []).forEach(s => {
    const r = revSheet.addRow([s.created_at?.slice(0, 10), 'منتجات', s.invoice_number, s.customer_name, Number((s.subtotal || 0).toFixed(2))]);
    r.getCell(5).numFmt = '#,##0.00';
  });

  // ── Expenses detail ──
  const expSheet = wb.addWorksheet('تفاصيل المصاريف', { views: [{ rightToLeft: true }] });
  expSheet.columns = [{ width: 14 }, { width: 18 }, { width: 30 }, { width: 14 }];
  styleHeaderRow(expSheet.addRow(['التاريخ', 'التصنيف', 'الوصف', 'المبلغ']));
  (expenses || []).forEach(e => {
    const r = expSheet.addRow([e.expense_date, CATEGORY_AR[e.category] || e.category, e.description || '', Number((e.amount || 0).toFixed(2))]);
    r.getCell(4).numFmt = '#,##0.00';
  });
  const totalRow = expSheet.addRow(['', '', 'الإجمالي', Number(totalExpenses.toFixed(2))]);
  totalRow.font = { bold: true };
  totalRow.getCell(4).numFmt = '#,##0.00';

  // ── Tax detail ──
  const taxSheet = wb.addWorksheet('الضرائب', { views: [{ rightToLeft: true }] });
  taxSheet.columns = [{ width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 12 }];
  styleHeaderRow(taxSheet.addRow(['التاريخ', 'النوع', 'الرقم', 'صافي المبلغ', 'الضريبة (15%)']));
  reported.forEach(r0 => {
    const sub = r0.subtotal ?? (r0.total_price || 0) / 1.15;
    const r = taxSheet.addRow([
      r0.created_at?.slice(0, 10), r0.order_number ? 'إصلاح' : 'منتجات', r0.order_number || r0.invoice_number,
      Number(sub.toFixed(2)), Number((sub * 0.15).toFixed(2)),
    ]);
    r.getCell(4).numFmt = '#,##0.00'; r.getCell(5).numFmt = '#,##0.00';
  });

  // ── Purchases / Input VAT sheet — هذا الجدول هو "الإقرار الجاهز" لضريبة المدخلات ──
  const purchSheet = wb.addWorksheet('المشتريات وضريبة المدخلات', { views: [{ rightToLeft: true }] });
  purchSheet.columns = [
    { width: 14 }, { width: 22 }, { width: 16 }, { width: 16 },
    { width: 14 }, { width: 14 }, { width: 20 }, { width: 16 },
  ];
  styleHeaderRow(purchSheet.addRow([
    'التاريخ', 'المورد', 'رقم الفاتورة', 'الرقم الضريبي للمورد',
    'الخاضع للضريبة', 'قيمة الضريبة', 'التصنيف', 'مقبولة بالإقرار؟',
  ]));
  (purchases || []).forEach(p => {
    const r = purchSheet.addRow([
      p.invoice_date, p.suppliers?.name || '—', p.invoice_number, p.supplier_vat_number_snapshot || '—',
      Number((p.taxable_amount || 0).toFixed(2)), Number((p.vat_amount || 0).toFixed(2)),
      p.tax_classification === 'raw_material' ? 'مادة خام خاضعة' : 'مصروف آخر',
      p.vat_number_valid_format ? 'نعم' : 'لا — رقم ضريبي غير صالح',
    ]);
    r.getCell(5).numFmt = '#,##0.00'; r.getCell(6).numFmt = '#,##0.00';
    if (!p.vat_number_valid_format) {
      r.eachCell((cell) => { cell.font = { color: { argb: 'FFDC2626' } }; });
    }
  });
  const purchTotalRow = purchSheet.addRow(['', '', '', 'إجمالي ضريبة المدخلات القابلة للخصم', '', Number(vatPaidDeductible.toFixed(2)), '', '']);
  purchTotalRow.font = { bold: true };
  purchTotalRow.getCell(6).numFmt = '#,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="statement-${startDay}.xlsx"`);
  return res.status(200).send(Buffer.from(buffer));
}
