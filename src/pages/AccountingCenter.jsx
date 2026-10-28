/**
 * AccountingCenter — المركز المحاسبي
 * ──────────────────────────────────────────────────────────────────
 * لوحة واحدة تجمع القوائم المالية بأسلوب مكاتب المحاسبة: قائمة الدخل،
 * ملخص ضريبة القيمة المضافة، الأرصدة المفتوحة، الاتجاه السنوي، ودفتر الحركات.
 * كل الأرقام من محرك المحاسبة الموحّد (accounting_report) — نفس ما يعرضه
 * تطبيق الجوال حرفياً. التصميم نفسه منقول لتطبيق Flutter (نفس الألوان والترتيب).
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { RefreshCw, Printer, ArrowUpRight, Search } from 'lucide-react';
import { getSession } from '@/lib/sessionStore';
import { isFinanceUser } from '@/lib/roles';
import { Sar } from '@/components/shared/SarCurrency';
import {
  fetchAccountingReport, PERIODS, LEDGER_KINDS, EXPENSE_CATEGORY_LABELS, money, moneyShort,
} from '@/lib/accounting';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthLabel = (mk) => { const [, m] = String(mk).split('-'); return MONTHS_AR[(Number(m) || 1) - 1] || mk; };

const CSS = `
.ac{--ac-bg:#0b0b0c;--ac-s1:#121213;--ac-s2:#18181a;--ac-line:rgba(236,232,223,.09);--ac-line2:rgba(236,232,223,.16);
  --ac-tx:#ece8df;--ac-mu:rgba(236,232,223,.58);--ac-fa:rgba(236,232,223,.38);--ac-gold:#c9a84c;--ac-gold2:rgba(201,168,76,.14);
  --ac-neg:#d98b7a;--ac-pos:#9cc3a4;
  background:var(--ac-bg);color:var(--ac-tx);border-radius:18px;padding:28px;margin:-4px;font-feature-settings:"tnum" 1,"lnum" 1}
@media (max-width:640px){.ac{padding:18px 14px;border-radius:14px;margin:-8px}}
.ac *{box-sizing:border-box}
.ac-eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--ac-gold);font-weight:600}
.ac-title{font-size:30px;font-weight:700;margin:6px 0 4px;letter-spacing:-.01em}
.ac-sub{color:var(--ac-mu);font-size:13px}
.ac-head{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end;justify-content:space-between;padding-bottom:22px;border-bottom:1px solid var(--ac-line)}
.ac-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ac-chip{height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--ac-line2);background:transparent;color:var(--ac-mu);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s}
.ac-chip:hover{color:var(--ac-tx);border-color:rgba(236,232,223,.3)}
.ac-chip[aria-pressed=true]{background:var(--ac-gold);border-color:var(--ac-gold);color:#0b0b0c}
.ac input.ac-date{height:34px;border-radius:999px;border:1px solid var(--ac-line2)!important;background:transparent!important;color:var(--ac-tx)!important;padding:0 12px;font-size:12.5px;color-scheme:dark;box-shadow:none!important}
.ac-icon{width:34px;height:34px;border-radius:999px;border:1px solid var(--ac-line2);background:transparent;color:var(--ac-mu);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.ac-icon:hover{color:var(--ac-tx)}
.ac-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--ac-line);border:1px solid var(--ac-line);border-radius:14px;overflow:hidden;margin:24px 0}
@media (max-width:1100px){.ac-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:520px){.ac-kpis{grid-template-columns:1fr}}
.ac-kpi{background:var(--ac-s1);padding:20px 20px 18px;min-height:120px}
.ac-kpi small{display:block;color:var(--ac-mu);font-size:12px;margin-bottom:12px}
.ac-kpi b{display:block;font-size:26px;font-weight:700;letter-spacing:-.01em}
.ac-kpi em{display:block;font-style:normal;color:var(--ac-fa);font-size:11.5px;margin-top:8px}
.ac-kpi.gold b{color:var(--ac-gold)}
.ac-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:20px}
@media (max-width:1100px){.ac-grid{grid-template-columns:1fr}}
.ac-card{background:var(--ac-s1);border:1px solid var(--ac-line);border-radius:14px;padding:22px}
.ac-card h3{font-size:15px;font-weight:700;margin:0}
.ac-card .ac-en{color:var(--ac-fa);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.ac-ch{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
.ac-row{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid var(--ac-line);font-size:13.5px}
.ac-row span:first-child{color:var(--ac-mu)}
.ac-row.ind span:first-child{padding-inline-start:14px}
.ac-row.sum{border-bottom:1px solid var(--ac-line2);font-weight:700}
.ac-row.sum span:first-child{color:var(--ac-tx)}
.ac-row.grand{border-bottom:0;border-top:1px solid var(--ac-gold);margin-top:6px;padding-top:14px;font-size:16px;font-weight:700}
.ac-row.grand span:first-child{color:var(--ac-tx)}
.ac-neg{color:var(--ac-neg)}
.ac-goldtx{color:var(--ac-gold)}
.ac-note{color:var(--ac-fa);font-size:11.5px;margin-top:12px;line-height:1.7}
.ac-bal{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px}
.ac-bal div{background:var(--ac-s2);border:1px solid var(--ac-line);border-radius:12px;padding:14px}
.ac-bal small{color:var(--ac-mu);font-size:11.5px;display:block;margin-bottom:8px}
.ac-bal b{font-size:18px}
.ac-bal em{display:block;font-style:normal;color:var(--ac-fa);font-size:11px;margin-top:4px}
.ac-trend{display:flex;align-items:flex-end;gap:8px;height:180px;padding-top:10px}
.ac-tcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;height:100%;justify-content:flex-end}
.ac-bars{display:flex;align-items:flex-end;gap:3px;height:100%;width:100%;justify-content:center}
.ac-bar{width:42%;max-width:16px;border-radius:4px 4px 0 0;min-height:2px}
.ac-bar.r{background:var(--ac-gold)}
.ac-bar.c{background:rgba(236,232,223,.22)}
.ac-tcol span{font-size:10px;color:var(--ac-fa);white-space:nowrap}
.ac .ac-table thead,.ac .ac-table thead tr,.ac .ac-table th{background:transparent!important}
@media (max-width:640px){.ac-trend{gap:4px}.ac-tcol span{font-size:9px}.ac-tcol:nth-child(even) span{visibility:hidden}}
.ac-legend{display:flex;gap:16px;font-size:11.5px;color:var(--ac-mu)}
.ac-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-inline-end:6px;vertical-align:-1px}
.ac-led-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.ac-search{display:flex;align-items:center;gap:6px;height:34px;border:1px solid var(--ac-line2);border-radius:999px;padding:0 12px;color:var(--ac-mu);flex:1;min-width:180px;max-width:280px}
.ac .ac-search input{background:transparent!important;border:0!important;outline:0;box-shadow:none!important;color:var(--ac-tx)!important;font-size:12.5px;width:100%;height:auto;padding:0}
.ac .ac-search input::placeholder{color:var(--ac-fa)}
.ac-table{width:100%;border-collapse:collapse;font-size:13px}
.ac-table th{color:var(--ac-fa);font-weight:600;font-size:11px;letter-spacing:.06em;text-align:start;padding:10px 8px;border-bottom:1px solid var(--ac-line2);white-space:nowrap}
.ac-table td{padding:11px 8px;border-bottom:1px solid var(--ac-line);vertical-align:middle}
.ac-table td.n,.ac-table th.n{text-align:end;white-space:nowrap}
.ac-tag{display:inline-block;font-size:11px;padding:3px 9px;border-radius:999px;background:var(--ac-s2);border:1px solid var(--ac-line);color:var(--ac-mu);white-space:nowrap}
.ac-tag.in{color:var(--ac-gold);border-color:rgba(201,168,76,.35);background:var(--ac-gold2)}
.ac-scroll{overflow-x:auto;margin:0 -8px;padding:0 8px}
.ac-links{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:20px}
@media (max-width:1100px){.ac-links{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ac-link{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:1px solid var(--ac-line);border-radius:12px;color:var(--ac-tx);text-decoration:none;font-size:13px;background:var(--ac-s1);transition:border-color .15s}
.ac-link:hover{border-color:rgba(201,168,76,.5)}
.ac-link svg{color:var(--ac-gold)}
.ac-sk{background:linear-gradient(90deg,var(--ac-s1),var(--ac-s2),var(--ac-s1));background-size:200% 100%;animation:acsk 1.4s infinite;border-radius:10px}
@keyframes acsk{0%{background-position:200% 0}100%{background-position:-200% 0}}
.ac-empty{padding:34px 10px;text-align:center;color:var(--ac-mu);font-size:13px}
.ac-err{border:1px solid rgba(217,139,122,.4);background:rgba(217,139,122,.08);color:var(--ac-tx);border-radius:12px;padding:16px;margin-top:20px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
.ac-btn{height:34px;padding:0 16px;border-radius:999px;border:0;background:var(--ac-gold);color:#0b0b0c;font-weight:700;font-size:12.5px;cursor:pointer}
@media print{
  .ac{background:#fff;color:#111;padding:0;--ac-tx:#111;--ac-mu:#555;--ac-fa:#777;--ac-line:#ddd;--ac-line2:#bbb;--ac-s1:#fff;--ac-s2:#f6f6f6;--ac-gold:#8a6d1f}
  .ac-tools,.ac-led-tools,.ac-links{display:none!important}
}
`;

const Money = ({ v, neg, className = '' }) => {
  const n = Number(v) || 0;
  const isNeg = neg || n < 0;
  return <Sar className={`${isNeg ? 'ac-neg' : ''} ${className}`}>{isNeg ? `(${money(Math.abs(n))})` : money(n)}</Sar>;
};

export default function AccountingCenter() {
  const session = getSession();
  const [preset, setPreset] = useState('thisMonth');
  const [range, setRange] = useState(PERIODS.thisMonth.range());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [from, to] = range;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await fetchAccountingReport(from, to)); }
    catch (e) { setError(e.message || 'تعذّر تحميل الأرقام'); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const ledger = useMemo(() => {
    const rows = data?.ledger || [];
    const term = q.trim().toLowerCase();
    return rows.filter((r) => (kind === 'all' || r.kind === kind)
      && (!term || `${r.ref || ''} ${r.party || ''}`.toLowerCase().includes(term)));
  }, [data, kind, q]);

  if (!session?.role || !isFinanceUser(session.role)) return <Navigate to="/pos" replace />;

  const IS = data?.income_statement || {};
  const VAT = data?.vat || {};
  const BAL = data?.balances || {};
  const trend = data?.trend || [];
  const maxT = Math.max(1, ...trend.map((t) => Math.max(Number(t.revenue) || 0, Number(t.costs) || 0)));
  const kindsPresent = ['all', ...Object.keys(LEDGER_KINDS).filter((k) => (data?.ledger || []).some((r) => r.kind === k))];

  const pick = (key) => { setPreset(key); setRange(PERIODS[key].range()); };
  const setCustom = (which, val) => {
    if (!val) return;
    const d = new Date(`${val}T00:00:00`);
    setPreset('custom');
    setRange(which === 'from' ? [d, to < d ? d : to] : [from > d ? d : from, d]);
  };

  return (
    <div className="ac" dir="rtl">
      <style>{CSS}</style>

      <header className="ac-head">
        <div>
          <div className="ac-eyebrow">Accounting Centre</div>
          <h1 className="ac-title">المركز المحاسبي</h1>
          <div className="ac-sub" dir="ltr" style={{ textAlign: 'right' }}>{format(from, 'yyyy-MM-dd')} → {format(to, 'yyyy-MM-dd')}</div>
        </div>
        <div className="ac-tools">
          {Object.entries(PERIODS).map(([k, p]) => (
            <button key={k} type="button" className="ac-chip" aria-pressed={preset === k} onClick={() => pick(k)}>{p.label}</button>
          ))}
          <input className="ac-date" type="date" aria-label="من تاريخ" value={format(from, 'yyyy-MM-dd')} onChange={(e) => setCustom('from', e.target.value)} />
          <input className="ac-date" type="date" aria-label="إلى تاريخ" value={format(to, 'yyyy-MM-dd')} onChange={(e) => setCustom('to', e.target.value)} />
          <button type="button" className="ac-icon" onClick={load} title="تحديث" aria-label="تحديث"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          <button type="button" className="ac-icon" onClick={() => window.print()} title="طباعة" aria-label="طباعة"><Printer size={15} /></button>
        </div>
      </header>

      {error && (
        <div className="ac-err" role="alert">
          <span>{error}</span>
          <button type="button" className="ac-btn" onClick={load}>إعادة المحاولة</button>
        </div>
      )}

      {/* ── المؤشرات الرئيسية ── */}
      <section className="ac-kpis" aria-busy={loading}>
        {loading && !data ? [0, 1, 2, 3].map((i) => <div key={i} className="ac-kpi"><div className="ac-sk" style={{ height: 14, width: '40%', marginBottom: 16 }} /><div className="ac-sk" style={{ height: 26, width: '70%' }} /></div>) : (
          <>
            <div className="ac-kpi">
              <small>صافي الإيراد</small>
              <b><Money v={IS.revenue_total} /></b>
              <em>{data?.counts?.sales || 0} مستند مبيعات · بدون ضريبة</em>
            </div>
            <div className="ac-kpi gold">
              <small>صافي الربح</small>
              <b><Money v={IS.net_profit} /></b>
              <em>{IS.net_margin_pct != null ? `هامش ${IS.net_margin_pct}%` : 'لا إيراد بالفترة'}</em>
            </div>
            <div className="ac-kpi">
              <small>ضريبة القيمة المضافة المستحقة</small>
              <b><Money v={VAT.net_vat_due} /></b>
              <em>مخرجات {money(VAT.output_vat)} − مدخلات {money(VAT.input_vat)}</em>
            </div>
            <div className="ac-kpi">
              <small>مستحقات لنا</small>
              <b><Money v={BAL.receivable} /></b>
              <em>{BAL.receivable_docs || 0} مستند غير مسدّد · رصيد لحظي</em>
            </div>
          </>
        )}
      </section>

      <div className="ac-grid">
        {/* ── قائمة الدخل ── */}
        <section className="ac-card">
          <div className="ac-ch"><h3>قائمة الدخل</h3><span className="ac-en">Income Statement</span></div>
          {loading && !data ? <div className="ac-sk" style={{ height: 320 }} /> : (
            <>
              <div className="ac-row sum"><span>الإيرادات</span><span /></div>
              <div className="ac-row ind"><span>خدمات الإصلاح</span><Money v={IS.revenue_repair} /></div>
              <div className="ac-row ind"><span>مبيعات المنتجات</span><Money v={IS.revenue_products} /></div>
              <div className="ac-row ind"><span>فواتير الشركات (B2B)</span><Money v={IS.revenue_partners} /></div>
              {Number(IS.revenue_adjustments || 0) !== 0 && <div className="ac-row ind"><span>إشعارات دائنة/مدينة</span><Money v={IS.revenue_adjustments} /></div>}
              <div className="ac-row sum"><span>صافي الإيرادات</span><Money v={IS.revenue_total} /></div>

              <div className="ac-row ind"><span>تكلفة البضاعة المباعة</span><Money v={-Number(IS.cogs_products || 0)} /></div>
              <div className="ac-row ind"><span>مواد الورشة{IS.materials_estimated ? ' (تقديري)' : ''}</span><Money v={-Number(IS.cogs_materials || 0)} /></div>
              <div className="ac-row sum"><span>مجمل الربح</span><Money v={IS.gross_profit} /></div>

              {(data?.expenses_by_category || []).length === 0
                ? <div className="ac-row ind"><span>المصاريف التشغيلية</span><Money v={0} /></div>
                : data.expenses_by_category.map((x) => (
                  <div key={x.category} className="ac-row ind"><span>{EXPENSE_CATEGORY_LABELS[x.category] || x.category}</span><Money v={-Number(x.amount)} /></div>
                ))}
              <div className="ac-row sum"><span>إجمالي المصاريف التشغيلية</span><Money v={-Number(IS.operating_expenses || 0)} /></div>

              <div className="ac-row grand"><span>{Number(IS.net_profit || 0) >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</span><Money v={IS.net_profit} className="ac-goldtx" /></div>
              <p className="ac-note">
                أساس الاستحقاق: الإيراد يُثبت بتاريخ الطلب/الفاتورة، والمبالغ بدون ضريبة. مشتريات المخزون بالفترة
                ({money(data?.inventory_purchases)}) أصل لا تُخصم مباشرة — تدخل التكلفة عند بيع المنتج أو سحب المادة للورشة.
              </p>
            </>
          )}
        </section>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          {/* ── ضريبة القيمة المضافة ── */}
          <section className="ac-card">
            <div className="ac-ch"><h3>ضريبة القيمة المضافة</h3><span className="ac-en">VAT · 15%</span></div>
            <div className="ac-row"><span>المبيعات الخاضعة</span><Money v={VAT.taxable_sales} /></div>
            <div className="ac-row"><span>ضريبة المخرجات</span><Money v={VAT.output_vat} /></div>
            <div className="ac-row ind"><span>مدخلات — مشتريات</span><Money v={-Number(VAT.input_vat_purchases || 0)} /></div>
            <div className="ac-row ind"><span>مدخلات — مصروفات بفاتورة ضريبية</span><Money v={-Number(VAT.input_vat_expenses || 0)} /></div>
            <div className="ac-row grand"><span>صافي الضريبة المستحقة</span><Money v={VAT.net_vat_due} className="ac-goldtx" /></div>
            <Link to="/tax-dashboard" className="ac-link" style={{ marginTop: 14 }}><span>نموذج الإقرار الضريبي كاملاً</span><ArrowUpRight size={16} /></Link>
          </section>

          {/* ── الأرصدة المفتوحة ── */}
          <section className="ac-card">
            <div className="ac-ch"><h3>الأرصدة المفتوحة</h3><span className="ac-en">Open Balances</span></div>
            <div className="ac-bal">
              <div><small>مستحقات لنا (عملاء)</small><b><Money v={BAL.receivable} /></b><em>{BAL.receivable_docs || 0} مستند</em></div>
              <div><small>مستحقات علينا (موردون)</small><b><Money v={BAL.payable} /></b><em>{BAL.payable_docs || 0} فاتورة</em></div>
            </div>
          </section>
        </div>
      </div>

      {/* ── الاتجاه الشهري ── */}
      <section className="ac-card" style={{ marginTop: 20 }}>
        <div className="ac-ch">
          <div><h3>آخر 12 شهراً</h3><span className="ac-en">Monthly Trend</span></div>
          <div className="ac-legend"><span><i style={{ background: 'var(--ac-gold)' }} />الإيراد</span><span><i style={{ background: 'rgba(236,232,223,.22)' }} />التكاليف</span></div>
        </div>
        {loading && !data ? <div className="ac-sk" style={{ height: 180 }} /> : (
          <div className="ac-trend" role="img" aria-label="الإيراد والتكاليف لآخر 12 شهراً">
            {trend.map((t) => (
              <div key={t.month} className="ac-tcol" title={`${t.month}: إيراد ${money(t.revenue)} · تكاليف ${money(t.costs)}`}>
                <div className="ac-bars">
                  <div className="ac-bar r" style={{ height: `${(Number(t.revenue) / maxT) * 100}%` }} />
                  <div className="ac-bar c" style={{ height: `${(Number(t.costs) / maxT) * 100}%` }} />
                </div>
                <span>{monthLabel(t.month)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── دفتر الحركات ── */}
      <section className="ac-card" style={{ marginTop: 20 }}>
        <div className="ac-ch"><h3>دفتر الحركات</h3><span className="ac-en">General Journal</span></div>
        <div className="ac-led-tools">
          {kindsPresent.map((k) => (
            <button key={k} type="button" className="ac-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'all' ? 'الكل' : LEDGER_KINDS[k]}</button>
          ))}
          <label className="ac-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم المستند أو الاسم" /></label>
        </div>
        {loading && !data ? <div className="ac-sk" style={{ height: 240 }} /> : ledger.length === 0 ? (
          <div className="ac-empty">لا توجد حركات تطابق الفترة أو البحث.</div>
        ) : (
          <div className="ac-scroll">
            <table className="ac-table">
              <thead><tr><th>التاريخ</th><th>النوع</th><th>المستند</th><th>الطرف</th><th className="n">الصافي</th><th className="n">الضريبة</th><th className="n">الإجمالي</th></tr></thead>
              <tbody>
                {ledger.map((r, i) => (
                  <tr key={`${r.kind}-${r.ref}-${i}`}>
                    <td dir="ltr" style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--ac-mu)' }}>{r.date}</td>
                    <td><span className={`ac-tag ${r.sign > 0 ? 'in' : ''}`}>{LEDGER_KINDS[r.kind] || r.kind}</span></td>
                    <td dir="ltr" style={{ textAlign: 'right' }}>{r.ref || '—'}</td>
                    <td>{r.kind === 'expense' ? (EXPENSE_CATEGORY_LABELS[r.party] || r.party) : r.party}{r.status === 'unpaid' ? <span className="ac-tag" style={{ marginInlineStart: 6 }}>غير مسدّد</span> : null}</td>
                    <td className="n"><Money v={r.sign * r.net} /></td>
                    <td className="n" style={{ color: 'var(--ac-mu)' }}>{moneyShort(r.vat)}</td>
                    <td className="n"><Money v={r.sign * r.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.ledger || []).length >= 400 && <p className="ac-note">يُعرض أحدث 400 حركة — ضيّق الفترة لرؤية الباقي.</p>}
          </div>
        )}
      </section>

      <nav className="ac-links" aria-label="أقسام المحاسبة">
        <Link className="ac-link" to="/invoices"><span>الفواتير</span><ArrowUpRight size={16} /></Link>
        <Link className="ac-link" to="/purchasing"><span>المشتريات</span><ArrowUpRight size={16} /></Link>
        <Link className="ac-link" to="/financial-reports"><span>المصاريف وكشف الحساب</span><ArrowUpRight size={16} /></Link>
        <Link className="ac-link" to="/tax-dashboard"><span>الإقرار الضريبي</span><ArrowUpRight size={16} /></Link>
        <Link className="ac-link" to="/zatca"><span>إعدادات زاتكا</span><ArrowUpRight size={16} /></Link>
      </nav>
    </div>
  );
}
