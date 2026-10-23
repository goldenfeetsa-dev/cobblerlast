/** وثائق الشركات: الفاتورة الضريبية وكشف الحساب — تصميم ورقي A4 قابل للطباعة */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, X } from 'lucide-react';
import { db, APP_SETTINGS_SAFE_COLUMNS } from '@/api/supabaseApi';

const INK = '#1f1a17';
const BRAND = '#7c4a1e';
const SOFT = '#f7f1ea';
const LINE = '#e6dccf';

const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => (d ? String(d).slice(0, 10) : '—');

const CSS = `
.pdoc{font-family:'Tajawal','Cairo','Segoe UI',Tahoma,sans-serif;color:${INK};background:#fff;width:100%;max-width:794px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.pdoc *{box-sizing:border-box}
.pdoc-head{background:${BRAND};color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:center;gap:16px}
.pdoc-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:.2px}
.pdoc-head .sub{font-size:11px;opacity:.8;margin-top:2px}
.pdoc-title{text-align:left}
.pdoc-title .ar{font-size:24px;font-weight:800;line-height:1.1}
.pdoc-title .en{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;opacity:.85;margin-top:4px}
.pdoc-body{padding:22px 28px 26px}
.pdoc-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.pdoc-meta div{background:${SOFT};border-radius:10px;padding:9px 12px}
.pdoc-meta small{display:block;font-size:10px;color:#8a7a6a;margin-bottom:2px}
.pdoc-meta b{font-size:13px}
.pdoc-parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
.pdoc-card{border:1px solid ${LINE};border-radius:12px;padding:12px 14px;font-size:12px;line-height:1.9}
.pdoc-card h3{margin:0 0 4px;font-size:11px;font-weight:700;color:${BRAND};letter-spacing:.4px}
.pdoc-card .nm{font-size:14px;font-weight:800}
.pdoc table{width:100%;border-collapse:collapse;font-size:12px}
.pdoc thead th{background:${INK};color:#fff;padding:9px 10px;font-weight:600;text-align:right;font-size:11px}
.pdoc thead th:first-child{border-radius:0 8px 8px 0}.pdoc thead th:last-child{border-radius:8px 0 0 8px}
.pdoc td{padding:9px 10px;border-bottom:1px solid ${LINE};vertical-align:top}
.pdoc tbody tr:nth-child(even) td{background:#fcfaf7}
.pdoc .num{text-align:center;white-space:nowrap}
.pdoc .tot{margin-top:16px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.pdoc .box{min-width:260px;border:1px solid ${LINE};border-radius:12px;overflow:hidden;font-size:13px}
.pdoc .box div{display:flex;justify-content:space-between;padding:8px 14px}
.pdoc .box .grand{background:${BRAND};color:#fff;font-weight:800;font-size:15px}
.pdoc .qr{text-align:center;font-size:10px;color:#8a7a6a}
.pdoc .qr canvas{border:1px solid ${LINE};border-radius:10px;padding:6px}
.pdoc-foot{border-top:1px dashed ${LINE};margin-top:18px;padding-top:12px;text-align:center;font-size:11px;color:#8a7a6a}
.pdoc .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700}
.pdoc .ok{background:#d9f2e4;color:#0b6b3a}.pdoc .no{background:#fde2e0;color:#b3261e}
.pdoc-actions{display:flex;gap:8px;max-width:794px;margin:12px auto 0}
.pdoc-actions button{flex:1;padding:11px;border-radius:12px;font-weight:700;border:0;cursor:pointer;display:flex;gap:6px;align-items:center;justify-content:center}
@media print{
  @page{size:A4;margin:10mm}
  body *{visibility:hidden}
  .pdoc-root,.pdoc-root *{visibility:visible}
  .pdoc-root{position:absolute;inset:0;background:#fff!important;padding:0!important}
  .pdoc{box-shadow:none;border-radius:0;max-width:none}
  .pdoc-actions{display:none!important}
  .pdoc *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media (max-width:640px){.pdoc-meta{grid-template-columns:1fr 1fr}.pdoc-parties{grid-template-columns:1fr}.pdoc .tot{flex-direction:column-reverse;align-items:stretch}.pdoc-head{flex-direction:column;align-items:flex-start}.pdoc-title{text-align:right}}
`;

function useShop() {
  const { data } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => db.AppSettings.list('-created_at', 200, APP_SETTINGS_SAFE_COLUMNS),
    staleTime: 60_000,
  });
  return (data && data[0]) || {};
}

function Shell({ onClose, children, label }) {
  return (
    <div className="pdoc-root fixed inset-0 z-50 bg-black/60 overflow-auto p-3" onClick={onClose}>
      <style>{CSS}</style>
      <div dir="rtl" onClick={(e) => e.stopPropagation()}>
        {children}
        <div className="pdoc-actions">
          <button onClick={() => window.print()} style={{ background: BRAND, color: '#fff' }}><Printer size={16} />{label}</button>
          <button onClick={onClose} style={{ background: '#fff', color: INK, flex: '0 0 auto', padding: '11px 20px' }}><X size={16} />إغلاق</button>
        </div>
      </div>
    </div>
  );
}

function Header({ shop, ar, en }) {
  return (
    <div className="pdoc-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {shop.logo_url && <img src={shop.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: 12, background: '#fff', objectFit: 'contain', padding: 4 }} />}
        <div>
          <h1>{shop.shop_name || 'إبرة وخيط الإسكافي'}</h1>
          <div className="sub">{[shop.city, shop.phone].filter(Boolean).join(' · ') || 'إصلاح الأحذية والحقائب'}</div>
        </div>
      </div>
      <div className="pdoc-title"><div className="ar">{ar}</div><div className="en">{en}</div></div>
    </div>
  );
}

export function PartnerInvoiceDoc({ inv, onClose }) {
  const shop = useShop();
  const items = Array.isArray(inv.items) ? inv.items : [];
  return (
    <Shell onClose={onClose} label="طباعة الفاتورة">
      <div className="pdoc">
        <Header shop={shop} ar="فاتورة ضريبية" en="Tax Invoice" />
        <div className="pdoc-body">
          <div className="pdoc-meta">
            <div><small>رقم الفاتورة</small><b dir="ltr">{inv.invoice_number}</b></div>
            <div><small>تاريخ الإصدار</small><b>{day(inv.created_at)}</b></div>
            <div><small>طريقة الدفع</small><b>{({ online: 'تحويل / إلكتروني', cash: 'نقداً', network: 'شبكة', mada: 'مدى', card: 'بطاقة' })[inv.payment_method] || '—'}</b></div>
          </div>
          <div className="pdoc-parties">
            <div className="pdoc-card">
              <h3>البائع</h3>
              <div className="nm">{shop.shop_name || 'إبرة وخيط الإسكافي'}</div>
              {shop.vat_number && <div>الرقم الضريبي: <b dir="ltr">{shop.vat_number}</b></div>}
              {shop.cr_number && <div>السجل التجاري: <span dir="ltr">{shop.cr_number}</span></div>}
              {(shop.address || shop.city) && <div>{[shop.address, shop.city].filter(Boolean).join('، ')}</div>}
            </div>
            <div className="pdoc-card">
              <h3>العميل</h3>
              <div className="nm">{inv.buyer_company_name || '—'}</div>
              {inv.buyer_vat_number && <div>الرقم الضريبي: <b dir="ltr">{inv.buyer_vat_number}</b></div>}
              {inv.buyer_cr_number && <div>السجل التجاري: <span dir="ltr">{inv.buyer_cr_number}</span></div>}
              {inv.buyer_address && <div>{inv.buyer_address}</div>}
            </div>
          </div>
          <table>
            <thead><tr><th style={{ width: 34 }}>#</th><th>البند</th><th className="num">الكمية</th><th className="num">السعر</th><th className="num">الإجمالي</th></tr></thead>
            <tbody>
              {items.map((it, k) => (
                <tr key={k}>
                  <td className="num">{k + 1}</td>
                  <td>{it.item_name}</td>
                  <td className="num">{it.qty}</td>
                  <td className="num">{money(it.sell_price)}</td>
                  <td className="num"><b>{money(Number(it.sell_price) * Number(it.qty || 1))}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tot">
            <div className="qr">
              {inv.zatca_qr ? <QRCodeCanvas value={inv.zatca_qr} size={128} level="M" /> : <div style={{ width: 140, color: '#b26a00' }}>رمز زاتكا قيد الإصدار</div>}
              <div style={{ marginTop: 4 }}>{inv.zatca_status === 'REPORTED' ? 'مُبلَّغة لهيئة الزكاة والضريبة والجمارك' : 'بانتظار الإبلاغ'}</div>
            </div>
            <div className="box">
              <div><span>المجموع قبل الضريبة</span><b>{money(inv.subtotal)}</b></div>
              <div><span>ضريبة القيمة المضافة 15%</span><b>{money(inv.vat_amount)}</b></div>
              <div className="grand"><span>الإجمالي المستحق</span><span>{money(inv.total)} ر.س</span></div>
            </div>
          </div>
          <div className="pdoc-foot">شكراً لتعاملكم معنا — {shop.shop_name || 'إبرة وخيط الإسكافي'}</div>
        </div>
      </div>
    </Shell>
  );
}

export function PartnerStatementDoc({ data, onClose }) {
  const shop = useShop();
  const p = data.partner;
  const today = data.today;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState('all');
  const invNo = Object.fromEntries((data.invoices || []).map((i) => [i.id, i.invoice_number]));
  const rows = (data.orders || [])
    .filter((o) => o.status !== 'cancelled' && Number(o.total_price) > 0)
    .filter((o) => (!from || day(o.created_at) >= from) && (!to || day(o.created_at) <= to))
    .filter((o) => mode === 'all' || (mode === 'paid') === (o.payment_status === 'paid'))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const sum = (f) => rows.filter(f).reduce((t, o) => t + Number(o.total_price || 0), 0);
  const isPaid = (o) => o.payment_status === 'paid';
  const paid = sum(isPaid);
  const unpaid = sum((o) => !isPaid(o));
  const overdue = sum((o) => !isPaid(o) && o.payment_due_date && day(o.payment_due_date) <= today);
  const chip = (k, l) => (
    <button key={k} onClick={() => setMode(k)} style={{ padding: '4px 12px', borderRadius: 99, border: `1px solid ${LINE}`, fontWeight: 700, fontSize: 12, background: mode === k ? BRAND : '#fff', color: mode === k ? '#fff' : INK }}>{l}</button>
  );
  return (
    <Shell onClose={onClose} label="طباعة / حفظ PDF">
      <div className="pdoc">
        <Header shop={shop} ar="كشف حساب" en="Statement of Account" />
        <div className="pdoc-body">
          <div className="pdoc-parties">
            <div className="pdoc-card">
              <h3>العميل</h3>
              <div className="nm">{p.name}</div>
              {p.vat_number && <div>الرقم الضريبي: <b dir="ltr">{p.vat_number}</b></div>}
              {p.cr_number && <div>السجل التجاري: <span dir="ltr">{p.cr_number}</span></div>}
            </div>
            <div className="pdoc-card">
              <h3>بيانات الكشف</h3>
              <div>تاريخ الإصدار: <b>{today}</b></div>
              <div>الفترة: <b>{from || 'من البداية'} → {to || today}</b></div>
              <div>مدة السداد: <b>{p.payment_terms_days} يوم من استلام الطلب</b></div>
            </div>
          </div>

          <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 12 }} data-noprint>
            <label>من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '3px 6px' }} /></label>
            <label>إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '3px 6px' }} /></label>
            {chip('all', 'الكل')}{chip('paid', 'المسدد')}{chip('unpaid', 'غير المسدد')}
          </div>

          <table>
            <thead><tr><th>التاريخ</th><th>الطلب</th><th>البيان</th><th className="num">موعد السداد</th><th className="num">الحالة</th><th className="num">الفاتورة</th><th className="num">المبلغ</th></tr></thead>
            <tbody>
              {rows.map((o) => {
                const ok = isPaid(o);
                const late = !ok && o.payment_due_date && day(o.payment_due_date) <= today;
                return (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{day(o.created_at)}</td>
                    <td dir="ltr" style={{ whiteSpace: 'nowrap' }}>{o.order_number}</td>
                    <td>{o.partner_ref ? <b>{o.partner_ref}</b> : null}{o.partner_ref ? ' — ' : ''}{o.description}</td>
                    <td className="num" style={late ? { color: '#b3261e', fontWeight: 700 } : null}>{ok ? '—' : day(o.payment_due_date)}</td>
                    <td className="num"><span className={`badge ${ok ? 'ok' : 'no'}`}>{ok ? 'مسدد' : late ? 'متأخر' : 'غير مسدد'}</span></td>
                    <td className="num" dir="ltr">{invNo[o.partner_invoice_id] || '—'}</td>
                    <td className="num"><b>{money(o.total_price)}</b></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#8a7a6a', padding: 24 }}>لا توجد حركات في هذه الفترة</td></tr>}
            </tbody>
          </table>

          <div className="tot" style={{ justifyContent: 'flex-end' }}>
            <div className="box">
              <div><span>إجمالي المسدد</span><b style={{ color: '#0b6b3a' }}>{money(paid)}</b></div>
              <div><span>إجمالي غير المسدد</span><b style={{ color: '#b3261e' }}>{money(unpaid)}</b></div>
              <div><span>منه مستحق الآن</span><b>{money(overdue)}</b></div>
              <div className="grand"><span>الرصيد المستحق</span><span>{money(unpaid)} ر.س</span></div>
            </div>
          </div>
          <div className="pdoc-foot">المبالغ شاملة ضريبة القيمة المضافة 15% — {shop.shop_name || 'إبرة وخيط الإسكافي'}</div>
        </div>
      </div>
      <style>{`@media print{[data-noprint]{display:none!important}}`}</style>
    </Shell>
  );
}
