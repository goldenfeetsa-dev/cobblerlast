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

  const [{ data: orders }, { data: sales }, { data: expenses }] = await Promise.all([
    supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end),
    supabase.from('sales_invoices').select('*').gte('created_at', start).lte('created_at', end),
    supabase.from('expenses').select('*').gte('expense_date', startDay).lte('expense_date', endDay),
  ]);

  const repairRevenue = (orders || []).reduce((s, o) => s + (o.subtotal ?? (o.total_price || 0) / 1.15), 0);
  const productRevenue = (sales || []).reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const totalRevenue = repairRevenue + productRevenue;
  const totalExpenses = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const reported = [...(orders || []).filter(o => o.zatca_status === 'REPORTED'), ...(sales || []).filter(s => s.zatca_status === 'REPORTED')];
  const vatCollected = reported.reduce((s, r) => s + (r.subtotal ?? (r.total_price || 0) / 1.15) * 0.15, 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cobblerlast';
  wb.created = new Date();

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
    ['ضريبة القيمة المضافة المُحصّلة (مُبلَّغة لزاتكا)', vatCollected],
  ];
  rows.forEach(([label, val], i) => {
    const r = summary.addRow([label, Number(val.toFixed(2))]);
    r.getCell(2).numFmt = '#,##0.00';
    if (label === 'إجمالي الإيراد' || label === 'صافي الربح') {
      r.font = { bold: true };
      r.getCell(2).font = { bold: true, color: { argb: label === 'صافي الربح' ? (netProfit >= 0 ? 'FF16A34A' : 'FFDC2626') : 'FF16A34A' } };
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

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="statement-${startDay}.xlsx"`);
  return res.status(200).send(Buffer.from(buffer));
}
