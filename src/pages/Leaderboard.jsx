import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Trophy, Medal, Crown, TrendingUp, Calendar, Building2, Wrench, CreditCard,
} from 'lucide-react';
import { format, startOfDay, startOfMonth, startOfYear } from 'date-fns';
import { unifyTransactions, summarizeEmployeePerformance, summarizeByBranch } from '@/lib/analytics';

const PERIODS = [
  { key: 'daily',   label: 'اليوم' },
  { key: 'monthly', label: 'الشهر' },
  { key: 'yearly',  label: 'السنة' },
  { key: 'all',     label: 'الكل' },
];

const rankIcons = [
  <Crown key="1" className="w-5 h-5 text-amber-500" />,
  <Medal key="2" className="w-5 h-5 text-gray-400" />,
  <Medal key="3" className="w-5 h-5 text-amber-700" />,
];

function RankRow({ i, name, branch, metricLabel, metricValue, secondaryLabel, secondaryValue }) {
  return (
    <Card className={i === 0 && metricValue > 0 ? 'border-primary/40 bg-primary/5' : ''}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold shrink-0">
            {i < 3 && metricValue > 0 ? rankIcons[i] : (
              <span className="text-xs text-muted-foreground font-bold">#{i + 1}</span>
            )}
          </div>
          <div>
            <p className="font-bold text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{branch}</p>
          </div>
        </div>
        <div className="flex gap-5 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="font-bold">{metricValue}</span>
            <span className="text-muted-foreground text-xs">{metricLabel}</span>
          </div>
          {secondaryLabel && (
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{secondaryValue}</span>
              <span className="text-muted-foreground text-xs">{secondaryLabel}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Leaderboard() {
  const session = getSession();
  const [period, setPeriod] = useState('monthly');
  const [branchFilter, setBranchFilter] = useState('all');

  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
    initialData: [],
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-leaderboard'],
    queryFn: () => base44.entities.Order.list('-created_at', 1000),
    initialData: [],
  });

  // مبيعات المنتجات — لازمة عشان تقييم الكاشير يكون على أساس صحيح
  // (مبيعاته)، مو على أساس طلبات إصلاح ما دخل فيها أصلاً
  const { data: salesInvoices = [] } = useQuery({
    queryKey: ['sales-invoices-leaderboard'],
    queryFn: () => base44.entities.SalesInvoice.list('-created_at', 1000),
    initialData: [],
  });

  if (!['admin','owner','manager'].includes(session?.role)) return <Navigate to="/pos" replace />;

  const now = new Date();
  const cutoff = period === 'daily'   ? startOfDay(now)
               : period === 'monthly' ? startOfMonth(now)
               : period === 'yearly'  ? startOfYear(now)
               : null;

  const filteredOrders = cutoff ? orders.filter(o => o.created_at && new Date(o.created_at) >= cutoff) : orders;
  const filteredSales = cutoff ? salesInvoices.filter(s => s.created_at && new Date(s.created_at) >= cutoff) : salesInvoices;

  const transactions = useMemo(
    () => unifyTransactions(filteredOrders, filteredSales),
    [filteredOrders, filteredSales]
  );

  const branchSummary = useMemo(() => summarizeByBranch(transactions), [transactions]);
  const branches = ['all', ...branchSummary.map(b => b.branch_name)];

  const branchTx = branchFilter === 'all'
    ? transactions
    : transactions.filter(t => t.branch_name === branchFilter);

  const branchEmployees = branchFilter === 'all'
    ? employees
    : employees.filter(e => (e.branch_name || 'الفرع الرئيسي') === branchFilter);

  const empStats = summarizeEmployeePerformance(branchEmployees, branchTx);

  // كاشير — يُرتَّب حسب إيراد المبيعات اللي حققه
  const cashiers = empStats
    .filter(e => e.role === 'cashier')
    .sort((a, b) => b.sales_revenue - a.sales_revenue);

  // فني/عامل — يُرتَّب حسب عدد إصلاحات "مكتملة" فعلاً، مو مجرد طلبات دخلت باسمه
  const technicians = empStats
    .filter(e => e.role === 'staff' || e.role === undefined || e.role === null)
    .sort((a, b) => b.completed_repairs_count - a.completed_repairs_count);

  // باقي الأدوار (مدير/محاسب... إلخ) — تُعرض بإجمالي الإيراد العام كمرجع فقط
  const others = empStats.filter(e => !cashiers.includes(e) && !technicians.includes(e));

  const topBranch = branchSummary[0];

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">لوحة المتصدرين</h1>
            <p className="text-sm text-muted-foreground">أفضل الفروع، وأفضل موظف حسب دوره الفعلي</p>
          </div>
        </div>

        {/* Period switcher */}
        <div className="flex rounded-xl border border-border p-1 bg-muted/30 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                period === p.key ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {empLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Period label */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              {period === 'daily'   && `اليوم — ${format(now, 'yyyy/MM/dd')}`}
              {period === 'monthly' && `شهر ${format(now, 'MMMM yyyy')}`}
              {period === 'yearly'  && `سنة ${format(now, 'yyyy')}`}
              {period === 'all'     && 'جميع الأوقات'}
            </span>
          </div>

          {/* أفضل فرع */}
          {branchSummary.length > 1 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Crown className="w-8 h-8 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">أفضل فرع من حيث الإيراد</p>
                      <p className="text-lg font-black">{topBranch?.branch_name}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-black text-primary">{topBranch?.revenue.toFixed(0)} ر.س</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* كل الفروع — مقارنة */}
          {branchSummary.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  ترتيب الفروع حسب الإيراد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {branchSummary.map((b, i) => (
                  <div key={b.branch_name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <span className="font-medium text-sm">{b.branch_name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{b.repairCount} إصلاح</span>
                      <span>{b.saleCount} بيع</span>
                      <span className="font-bold text-foreground">{b.revenue.toFixed(0)} ر.س</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Branch filter for employee rankings below */}
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">عرض موظفي:</span>
            {branches.map(b => (
              <button
                key={b}
                onClick={() => setBranchFilter(b)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  branchFilter === b ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {b === 'all' ? 'كل الفروع' : b}
              </button>
            ))}
          </div>

          {/* أفضل الكاشير — حسب إيراد المبيعات */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm">أفضل الكاشير — حسب إيراد المبيعات</h2>
            </div>
            {cashiers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">لا يوجد موظفون بدور "كاشير" لهذا الفرع/الفترة</p>
            ) : (
              <div className="space-y-2">
                {cashiers.map((e, i) => (
                  <RankRow
                    key={e.id}
                    i={i}
                    name={e.name}
                    branch={e.branch_name}
                    metricValue={e.sales_revenue.toFixed(0)}
                    metricLabel="ر.س مبيعات"
                    secondaryLabel="فاتورة بيع"
                    secondaryValue={e.sales_count}
                  />
                ))}
              </div>
            )}
          </div>

          {/* أفضل الفنيين/العمال — حسب عدد الإصلاحات المكتملة */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm">أفضل الفنيين — حسب عدد الإصلاحات المُنجزة (مكتملة فعلاً)</h2>
            </div>
            {technicians.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">لا يوجد موظفون بدور "عامل/فني" لهذا الفرع/الفترة</p>
            ) : (
              <div className="space-y-2">
                {technicians.map((e, i) => (
                  <RankRow
                    key={e.id}
                    i={i}
                    name={e.name}
                    branch={e.branch_name}
                    metricValue={e.completed_repairs_count}
                    metricLabel="إصلاح مكتمل"
                    secondaryLabel="إجمالي طلبات دخلت باسمه"
                    secondaryValue={e.repairs_count}
                  />
                ))}
              </div>
            )}
          </div>

          {/* باقي الأدوار (مدير/محاسب/مالك) — إجمالي الإيراد المرتبط بهم كمرجع فقط */}
          {others.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-bold text-sm text-muted-foreground">أدوار أخرى (مرجعي)</h2>
              </div>
              <div className="space-y-2">
                {others.sort((a, b) => b.total_revenue - a.total_revenue).map((e, i) => (
                  <RankRow
                    key={e.id}
                    i={i}
                    name={`${e.name} — ${e.role || 'بدون دور'}`}
                    branch={e.branch_name}
                    metricValue={e.total_revenue.toFixed(0)}
                    metricLabel="ر.س إجمالي"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
