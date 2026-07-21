import React, { useMemo, useState } from 'react';
import { db } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Wallet, Users, TrendingUp, Calendar, Building2, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import FinancialReport from '@/components/dashboard/FinancialReport';
import { unifyTransactions, summarizeByBranch } from '@/lib/analytics';

const PERIODS = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'الأسبوع' },
  { key: 'month', label: 'الشهر' },
  { key: 'year', label: 'السنة' },
  { key: 'custom', label: 'تاريخ محدد' },
  { key: 'all', label: 'الكل' },
];

function getPeriodStart(key) {
  const now = new Date();
  if (key === 'today') { const d = new Date(); d.setHours(0,0,0,0); return d; }
  if (key === 'week') { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; }
  if (key === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1); }
  if (key === 'year') { return new Date(now.getFullYear(), 0, 1); }
  return null;
}

function StatCard({ title, value, subtitle, icon: Icon, accentClass }) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 -translate-y-6 translate-x-6 rounded-full opacity-10 ${accentClass}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${accentClass} bg-opacity-10`}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const session = getSession();
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: allOrders } = useQuery({
    queryKey: ['orders', 'dashboard'],
    queryFn: () => db.Order.list('-created_at', 500),
    initialData: [],
  });

  // فواتير بيع المنتجات — كانت غائبة تماماً عن لوحة التحكم، فتُخفي جزءاً
  // كاملاً من الإيراد الفعلي لأي فرع يبيع منتجات وليس فقط يصلّح
  const { data: allSalesInvoices } = useQuery({
    queryKey: ['sales-invoices-dashboard'],
    queryFn: () => db.SalesInvoice.list('-created_at', 500),
    initialData: [],
  });

  // Branch filter + period filter
  const orders = useMemo(() => {
    let filtered = allOrders;
    if (!['admin','owner','manager'].includes(session?.role) && session?.branch_id) {
      filtered = filtered.filter(o => !o.branch_id || o.branch_id === session.branch_id);
    }
    if (period === 'custom') {
      filtered = filtered.filter(o => {
        const d = o.created_at ? new Date(o.created_at) : null;
        if (!d) return false;
        if (customFrom && d < new Date(customFrom + 'T00:00:00')) return false;
        if (customTo && d > new Date(customTo + 'T23:59:59')) return false;
        return true;
      });
    } else {
      const start = getPeriodStart(period);
      if (start) filtered = filtered.filter(o => o.created_at && new Date(o.created_at) >= start);
    }
    return filtered;
  }, [allOrders, session, period, customFrom, customTo]);

  const salesInvoices = useMemo(() => {
    let filtered = allSalesInvoices;
    if (!['admin','owner','manager'].includes(session?.role) && session?.branch_id) {
      filtered = filtered.filter(s => !s.branch_id || s.branch_id === session.branch_id);
    }
    if (period === 'custom') {
      filtered = filtered.filter(s => {
        const d = s.created_at ? new Date(s.created_at) : null;
        if (!d) return false;
        if (customFrom && d < new Date(customFrom + 'T00:00:00')) return false;
        if (customTo && d > new Date(customTo + 'T23:59:59')) return false;
        return true;
      });
    } else {
      const start = getPeriodStart(period);
      if (start) filtered = filtered.filter(s => s.created_at && new Date(s.created_at) >= start);
    }
    return filtered;
  }, [allSalesInvoices, session, period, customFrom, customTo]);

  // كل العمليات موحّدة (إصلاح + بيع) — الأساس لكل رقم دقيق بهذي الصفحة
  const transactions = useMemo(
    () => unifyTransactions(orders, salesInvoices),
    [orders, salesInvoices]
  );
  const branchSummary = useMemo(() => summarizeByBranch(transactions), [transactions]);
  const topBranch = branchSummary[0];
  const showBranches = ['admin','owner','manager'].includes(session?.role) && branchSummary.length > 1;

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => db.Customer.list(),
    initialData: [],
  });

  const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const paidOrders = transactions.filter(t => t.payment_status === 'paid');
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'in_progress');

  // Last 7 days chart
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayTx = transactions.filter(t => t.created_at && format(new Date(t.created_at), 'yyyy-MM-dd') === dateStr);
    last7.push({
      day: format(d, 'EEE'),
      orders: dayTx.length,
      revenue: dayTx.reduce((s, t) => s + (t.amount || 0), 0),
    });
  }

  const recentOrders = [...transactions]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مرحباً، {session?.name || 'المدير'}</h1>
          <p className="text-muted-foreground">نظرة عامة على أعمالك</p>
        </div>
        {/* Period filter */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${period === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex gap-3 mb-5 items-center flex-wrap p-3 rounded-xl bg-muted/30">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">من:</span>
          <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36 h-8" />
          <span className="text-sm text-muted-foreground">إلى:</span>
          <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-36 h-8" />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="إجمالي العمليات" value={transactions.length} subtitle={`${pendingOrders.length} إصلاح قيد الانتظار`} icon={ShoppingBag} accentClass="bg-primary" />
        <StatCard title="الإيرادات" value={`${totalRevenue.toFixed(0)} ر.س`} subtitle={`${paidOrders.length} عملية مدفوعة`} icon={Wallet} accentClass="bg-primary" />
        <StatCard title="العملاء" value={customers.length} icon={Users} accentClass="bg-primary" />
        <StatCard title="نسبة الإنجاز" value={orders.length ? `${Math.round((orders.filter(o => o.status === 'completed').length / orders.length) * 100)}%` : '0%'} icon={TrendingUp} accentClass="bg-primary" />
      </div>

      {/* مقارنة الفروع — أي فرع يحقق أعلى إيراد، ظاهرة فقط للإدارة ولو فيه أكثر من فرع */}
      {showBranches && (
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              الإيراد حسب الفرع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {branchSummary.map((b, i) => (
                <div
                  key={b.branch_name}
                  className={`rounded-xl p-4 border ${i === 0 ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm truncate">{b.branch_name}</span>
                    {i === 0 && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xl font-black">{b.revenue.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">ر.س</span></p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {b.count} عملية — {b.repairCount} إصلاح · {b.saleCount} بيع
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {['admin','owner','manager'].includes(session?.role) && (
        <div className="mb-8">
          <FinancialReport orders={transactions.map(t => ({
            total_price: t.amount, payment_method: t.payment_method,
            status: t.status, created_at: t.created_at,
          }))} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">آخر 7 أيام</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="hsl(38, 80%, 50%)" radius={[6, 6, 0, 0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">أحدث الطلبات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد طلبات بعد</p>
            ) : (
              recentOrders.map(t => (
                <Link
                  key={t.id}
                  to={t.kind === 'repair' ? `/orders/${t.raw.id}` : '/invoices'}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{t.raw.customer_name || '—'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t.number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{t.amount?.toFixed(0)} SAR</p>
                    <Badge variant="outline" className="text-[10px]">
                      {t.kind === 'repair' ? (t.status || '—') : 'بيع منتج'}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}