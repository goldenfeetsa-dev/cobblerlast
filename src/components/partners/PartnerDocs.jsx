/** وثائق الشركات: الفاتورة الضريبية وكشف الحساب — تصميم ورقي A4 قابل للطباعة */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, X } from 'lucide-react';
import { db, APP_SETTINGS_SAFE_COLUMNS } from '@/api/supabaseApi';

import { Sar, SarSymbol } from '@/components/shared/SarCurrency';
const INK = '#111827';
const BRAND = '#111827';
const ACC = '#14407a';
const SOFT = '#f3f4f6';
const LINE = '#e5e7eb';
const MUT = '#6b7280';

const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => (d ? String(d).slice(0, 10) : '—');

const CSS = `
.pdoc{font-family:'IBM Plex Sans Arabic','IBM Plex Sans','Tajawal','Segoe UI',Tahoma,sans-serif;color:${INK};background:#fff;width:100%;max-width:794px;margin:0 auto;overflow:hidden;font-size:12px}
.pdoc *{box-sizing:border-box;font-variant-numeric:tabular-nums}
.pdoc-head{padding:30px 34px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid ${INK}}
.pdoc-co{display:flex;align-items:center;gap:14px}
.pdoc-co img{height:56px;width:auto;filter:brightness(0)}
.pdoc-co b{font-size:16px;display:block}
.pdoc-co div div{color:${MUT};font-size:10.5px;line-height:1.7;margin-top:3px}
.pdoc-title{text-align:left}
.pdoc-title .en{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:${MUT}}
.pdoc-title .ar{font-size:26px;font-weight:700;line-height:1.2;margin:2px 0}
.pdoc-title .sn{font-size:11px;color:${MUT}}
.pdoc-body{padding:18px 34px 26px}
.pdoc-meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid ${INK};margin-bottom:14px}
.pdoc-meta div{padding:8px 12px;border-inline-start:1px solid #d1d5db}
.pdoc-meta div:first-child{border:0}
.pdoc-meta small{display:block;font-size:9.5px;color:${MUT};margin-bottom:2px;letter-spacing:.04em}
.pdoc-meta b{font-size:12.5px}
.pdoc-parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid ${INK};margin-bottom:16px}
.pdoc-card{padding:10px 14px;font-size:11.5px;line-height:1.9;color:#374151}
.pdoc-card+.pdoc-card{border-inline-start:1px solid #d1d5db}
.pdoc-card h3{margin:0 0 2px;font-size:9.5px;font-weight:600;color:${MUT};letter-spacing:.06em}
.pdoc-card .nm{font-size:13.5px;font-weight:700;color:${INK}}
.pdoc table{width:100%;border-collapse:collapse;font-size:11.5px}
.pdoc thead th{background:${SOFT};color:${INK};padding:8px 9px;font-weight:600;text-align:right;font-size:10.5px;border-top:1px solid ${INK};border-bottom:1px solid ${INK}}
.pdoc thead th i{display:block;font-style:normal;font-weight:400;color:${MUT};font-size:9px}
.pdoc td{padding:9px;border-bottom:1px solid ${LINE};vertical-align:top}
.pdoc .num{text-align:left;white-space:nowrap}
.pdoc td.num,.pdoc th.num{text-align:center}
.pdoc .tot{margin-top:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.pdoc .box{min-width:290px;border:1px solid ${INK};font-size:12px}
.pdoc .box div{display:flex;justify-content:space-between;gap:12px;padding:8px 13px;border-bottom:1px solid ${LINE}}
.pdoc .box .grand{background:${INK};color:#fff;font-weight:700;font-size:14px;border:0;white-space:nowrap}
.pdoc .qr{font-size:10px;color:${MUT};display:flex;gap:12px;align-items:center;max-width:300px}
.pdoc .qr canvas{border:1px solid ${INK};padding:3px}
.pdoc-foot{border-top:1px solid #d1d5db;margin-top:22px;padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:${MUT}}
.pdoc-note{margin-top:16px;font-size:10.5px;color:${MUT};line-height:1.9}
.pdoc .badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--c)}
.pdoc .badge:before{content:'';width:7px;height:7px;background:var(--c)}
.pdoc .ok{--c:#127a4a}.pdoc .no{--c:#b42318}
.pdoc-actions{display:flex;gap:8px;max-width:794px;margin:12px auto 0}
.pdoc-actions button{flex:1;padding:11px;font-weight:600;border:0;cursor:pointer;display:flex;gap:6px;align-items:center;justify-content:center}
@media print{
  @page{size:A4;margin:10mm}
  body *{visibility:hidden}
  .pdoc-root,.pdoc-root *{visibility:visible}
  .pdoc-root{position:absolute;inset:0;background:#fff!important;padding:0!important;overflow:visible!important}
  .pdoc{box-shadow:none;max-width:none}
  .pdoc-actions{display:none!important}
  .pdoc *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pdoc tr{break-inside:avoid}
}
@media (max-width:640px){.pdoc-meta{grid-template-columns:1fr 1fr}.pdoc-parties{grid-template-columns:1fr}.pdoc-card+.pdoc-card{border-inline-start:0;border-top:1px solid #d1d5db}.pdoc .tot{flex-direction:column-reverse;align-items:stretch}.pdoc-head{flex-direction:column;align-items:flex-start}.pdoc-title{text-align:right}}
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
          <button onClick={() => window.print()} style={{ background: INK, color: '#fff' }}><Printer size={16} />{label}</button>
          <button onClick={onClose} style={{ background: '#fff', color: INK, flex: '0 0 auto', padding: '11px 20px', border: '1px solid #d1d5db' }}><X size={16} />إغلاق</button>
        </div>
      </div>
    </div>
  );
}

function Header({ shop, ar, en, no }) {
  return (
    <div className="pdoc-head">
      <div className="pdoc-co">
        <img src="/images/cobblers-official-mark.png" alt="" />
        <div>
          <b>{shop.shop_name || 'إبرة وخيط الإسكافي'}</b>
          <div>
            Needle &amp; Thread Cobbler<br />
            {[shop.address, shop.city].filter(Boolean).join('، ')}{shop.phone ? ` · ${shop.phone}` : ''}
          </div>
        </div>
      </div>
      <div className="pdoc-title"><div className="en">{en}</div><div className="ar">{ar}</div>{no ? <div className="sn" dir="ltr">{no}</div> : null}</div>
    </div>
  );
}

export function PartnerInvoiceDoc({ inv, onClose }) {
  const shop = useShop();
  const items = Array.isArray(inv.items) ? inv.items : [];
  const rate = Number(shop.vat_rate) || 15;
  const due = inv.due_date || inv.payment_due_date || null;
  return (
    <Shell onClose={onClose} label="طباعة الفاتورة">
      <div className="pdoc">
        <Header shop={shop} ar="فاتورة ضريبية" en="Tax Invoice" no={inv.invoice_number} />
        <div className="pdoc-body">
          <div className="pdoc-meta">
            <div><small>تاريخ الإصدار · Issue date</small><b>{day(inv.created_at)}</b></div>
            <div><small>تاريخ التوريد · Supply date</small><b>{day(inv.created_at)}</b></div>
            <div><small>طريقة الدفع · Payment</small><b>{({ online: 'تحويل / إلكتروني', cash: 'نقداً', network: 'شبكة', mada: 'مدى', card: 'بطاقة' })[inv.payment_method] || '—'}</b></div>
            <div><small>العملة · Currency</small><b><SarSymbol /></b></div>
          </div>
          <div className="pdoc-parties">
            <div className="pdoc-card">
              <h3>البائع · SELLER</h3>
              <div className="nm">{shop.shop_name || 'إبرة وخيط الإسكافي'}</div>
              {shop.vat_number && <div>الرقم الضريبي: <b dir="ltr">{shop.vat_number}</b></div>}
              {shop.cr_number && <div>السجل التجاري: <span dir="ltr">{shop.cr_number}</span></div>}
              {(shop.address || shop.city) && <div>{[shop.address, shop.city, 'المملكة العربية السعودية'].filter(Boolean).join('، ')}</div>}
              {shop.phone && <div>الهاتف: <span dir="ltr">{shop.phone}</span></div>}
            </div>
            <div className="pdoc-card">
              <h3>المشتري · BUYER</h3>
              <div className="nm">{inv.buyer_company_name || '—'}</div>
              {inv.buyer_vat_number && <div>الرقم الضريبي: <b dir="ltr">{inv.buyer_vat_number}</b></div>}
              {inv.buyer_cr_number && <div>السجل التجاري: <span dir="ltr">{inv.buyer_cr_number}</span></div>}
              {inv.buyer_address && <div>{inv.buyer_address}</div>}
            </div>
          </div>
          <table>
            <thead><tr>
              <th style={{ width: 30 }}>#</th>
              <th>الوصف<i>Description</i></th>
              <th className="num">الكمية<i>Qty</i></th>
              <th className="num">سعر الوحدة<i>Unit price</i></th>
              <th className="num">الخاضع للضريبة<i>Taxable</i></th>
              <th className="num">الضريبة {rate}٪<i>VAT</i></th>
              <th className="num">الإجمالي<i>Total</i></th>
            </tr></thead>
            <tbody>
              {items.map((it, k) => {
                const taxable = Number(it.sell_price) * Number(it.qty || 1);
                const vat = taxable * rate / 100;
                return (
                  <tr key={k}>
                    <td>{k + 1}</td>
                    <td>{it.item_name}</td>
                    <td className="num">{it.qty}</td>
                    <td className="num">{money(it.sell_price)}</td>
                    <td className="num">{money(taxable)}</td>
                    <td className="num">{money(vat)}</td>
                    <td className="num"><b>{money(taxable + vat)}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="tot">
            <div className="qr">
              {inv.zatca_qr ? <QRCodeCanvas value={inv.zatca_qr} size={110} level="M" /> : <div style={{ width: 120, color: '#9a6700' }}>رمز زاتكا قيد الإصدار</div>}
              <div>{inv.zatca_status === 'REPORTED' ? 'فاتورة إلكترونية مُبلَّغة لهيئة الزكاة والضريبة والجمارك' : 'بانتظار الإبلاغ لهيئة الزكاة والضريبة والجمارك'}</div>
            </div>
            <div className="box">
              <div><span>المجموع قبل الضريبة · Subtotal</span><b>{money(inv.subtotal)}</b></div>
              <div><span>ضريبة القيمة المضافة {rate}٪ · VAT</span><b>{money(inv.vat_amount)}</b></div>
              <div className="grand"><span>المستحق · Total due</span><span><Sar>{money(inv.total)}</Sar></span></div>
            </div>
          </div>
          <div className="pdoc-note">
            {due ? <>تاريخ الاستحقاق: <b>{day(due)}</b><br /></> : null}
            الأسعار والمبالغ بالريال السعودي وشاملة ضريبة القيمة المضافة في الإجمالي.
          </div>
          <div className="pdoc-foot"><span>{shop.shop_name || 'إبرة وخيط الإسكافي'} · needlecobbler.com{shop.phone ? ` · ${shop.phone}` : ''}</span><span dir="ltr">{inv.invoice_number}</span></div>
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
    <button key={k} onClick={() => setMode(k)} style={{ padding: '4px 14px', border: '1px solid #d1d5db', fontWeight: 600, fontSize: 12, background: mode === k ? INK : '#fff', color: mode === k ? '#fff' : INK }}>{l}</button>
  );
  return (
    <Shell onClose={onClose} label="طباعة / حفظ PDF">
      <div className="pdoc">
        <Header shop={shop} ar="كشف حساب" en="Statement of Account" no={`ST-${String(today).replace(/-/g, '').slice(2)}-${String(p.id || '').slice(0, 4).toUpperCase()}`} />
        <div className="pdoc-body">
          <div className="pdoc-parties">
            <div className="pdoc-card">
              <h3>العميل · CUSTOMER</h3>
              <div className="nm">{p.name}</div>
              {p.vat_number && <div>الرقم الضريبي: <b dir="ltr">{p.vat_number}</b></div>}
              {p.cr_number && <div>السجل التجاري: <span dir="ltr">{p.cr_number}</span></div>}
            </div>
            <div className="pdoc-card">
              <h3>بيانات الكشف · DETAILS</h3>
              <div>تاريخ الإصدار: <b>{today}</b></div>
              <div>الفترة: <b>{from || 'من البداية'} → {to || today}</b></div>
              <div>مدة السداد: <b>{p.payment_terms_days} يوم من استلام الطلب</b></div>
            </div>
          </div>

          <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 12 }} data-noprint>
            <label>من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ border: '1px solid #d1d5db', padding: '3px 6px' }} /></label>
            <label>إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ border: '1px solid #d1d5db', padding: '3px 6px' }} /></label>
            {chip('all', 'الكل')}{chip('paid', 'المسدد')}{chip('unpaid', 'غير المسدد')}
          </div>

          <table>
            <thead><tr><th>التاريخ<i>Date</i></th><th>الطلب<i>Order</i></th><th>البيان<i>Description</i></th><th className="num">الاستحقاق<i>Due</i></th><th className="num">الحالة<i>Status</i></th><th className="num">الفاتورة<i>Invoice</i></th><th className="num">المبلغ<i>Amount</i></th></tr></thead>
            <tbody>
              {rows.map((o) => {
                const ok = isPaid(o);
                const late = !ok && o.payment_due_date && day(o.payment_due_date) <= today;
                return (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{day(o.created_at)}</td>
                    <td dir="ltr" style={{ whiteSpace: 'nowrap' }}>{o.order_number}</td>
                    <td>{o.partner_ref ? <b>{o.partner_ref}</b> : null}{o.partner_ref ? ' — ' : ''}{o.description}</td>
                    <td className="num" style={late ? { color: '#b42318', fontWeight: 600 } : null}>{ok ? '—' : day(o.payment_due_date)}</td>
                    <td className="num"><span className={`badge ${ok ? 'ok' : 'no'}`}>{ok ? 'مسدد' : late ? 'متأخر' : 'غير مسدد'}</span></td>
                    <td className="num" dir="ltr">{invNo[o.partner_invoice_id] || '—'}</td>
                    <td className="num"><b>{money(o.total_price)}</b></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>لا توجد حركات في هذه الفترة</td></tr>}
            </tbody>
          </table>

          <div className="tot" style={{ justifyContent: 'flex-end' }}>
            <div className="box">
              <div><span>إجمالي المسدد · Paid</span><b style={{ color: '#127a4a' }}>{money(paid)}</b></div>
              <div><span>غير المسدد · Outstanding</span><b style={{ color: '#b42318' }}>{money(unpaid)}</b></div>
              <div><span>منه مستحق الآن · Overdue</span><b>{money(overdue)}</b></div>
              <div className="grand"><span>الرصيد المستحق · Balance</span><span><Sar>{money(unpaid)}</Sar></span></div>
            </div>
          </div>
          <div className="pdoc-note">المبالغ شاملة ضريبة القيمة المضافة. يُرجى مراجعة الكشف وإبلاغنا بأي ملاحظة خلال ٧ أيام من تاريخ الإصدار.</div>
          <div className="pdoc-foot"><span>{shop.shop_name || 'إبرة وخيط الإسكافي'} · needlecobbler.com{shop.phone ? ` · ${shop.phone}` : ''}</span><span>{today}</span></div>
        </div>
      </div>
      <style>{`@media print{[data-noprint]{display:none!important}}`}</style>
    </Shell>
  );
}
