/**
 * accounting.js — واجهة محرك المحاسبة الموحّد (Postgres: accounting_report)
 * ──────────────────────────────────────────────────────────────────
 * كل الأرقام المالية (الإيراد، الربح، الضريبة، المستحقات) تُحسب في دالة
 * واحدة بقاعدة البيانات، والموقع وتطبيق الجوال يقرؤون منها نفس الرقم.
 * الطلب يمر عبر بوابة الخادم /sb (كوكي الجلسة HttpOnly + تحقق الدور المالي).
 */
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear } from 'date-fns';

export async function fetchAccountingReport(from, to) {
  const res = await fetch('/sb/rest/v1/rpc/accounting_report', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_from: format(from, 'yyyy-MM-dd'), p_to: format(to, 'yyyy-MM-dd') }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = res.status === 401 ? 'انتهت الجلسة — سجّل الدخول من جديد'
      : res.status === 403 ? 'هذا القسم للإدارة والمحاسب فقط'
      : body.message || `تعذّر تحميل الأرقام (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export const PERIODS = {
  thisMonth: { label: 'هذا الشهر', range: () => [startOfMonth(new Date()), endOfMonth(new Date())] },
  lastMonth: { label: 'الشهر الماضي', range: () => { const d = subMonths(new Date(), 1); return [startOfMonth(d), endOfMonth(d)]; } },
  thisQuarter: { label: 'هذا الربع', range: () => [startOfQuarter(new Date()), endOfQuarter(new Date())] },
  lastQuarter: { label: 'الربع الماضي', range: () => { const d = subQuarters(new Date(), 1); return [startOfQuarter(d), endOfQuarter(d)]; } },
  thisYear: { label: 'هذه السنة', range: () => [startOfYear(new Date()), endOfYear(new Date())] },
};

// أنواع الحركات في الدفتر — نفس التسميات في تطبيق الجوال
export const LEDGER_KINDS = {
  repair: 'إيراد إصلاح',
  product: 'مبيعات منتجات',
  partner: 'فاتورة شركة',
  credit_note: 'إشعار دائن',
  debit_note: 'إشعار مدين',
  expense: 'مصروف',
  purchase: 'مشتريات مخزون',
};

export const EXPENSE_CATEGORY_LABELS = {
  rent: 'إيجار', salaries: 'رواتب', electricity: 'كهرباء', water: 'مياه', internet: 'إنترنت واتصالات',
  marketing: 'تسويق', maintenance: 'صيانة', supplies: 'مستلزمات', transportation: 'نقل ومواصلات',
  utilities: 'فواتير خدمات', other: 'أخرى',
};

// أرقام لاتينية بفاصلة آلاف ومنزلتين — نفس تنسيق التطبيق والإقرار الضريبي
export const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const moneyShort = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)}K`;
  return money(v);
};
