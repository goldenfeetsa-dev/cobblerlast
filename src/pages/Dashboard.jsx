import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Wallet, Users, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import FinancialReport from '@/components/dashboard/FinancialReport';

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
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
    initialData: [],
  });

  // Branch filter + period filter
  const orders = useMemo(() => {
    let filtered = allOrders;
    if (session?.role !== 'admin' && session?.branch_id) {
      filtered = filtered.filter(o => !o.branch_id || o.branch_id === session.branch_id);
    }
    if (period === 'custom') {
      filtered = filtered.filter(o => {
        const d = o.created_date ? new Date(o.created_date) : null;
        if (!d) return false;
        if (customFrom && d < new Date(customFrom + 'T00:00:00')) return false;
        if (customTo && d > new Date(customTo + 'T23:59:59')) return false;
        return true;
      });
    } else {
      const start = getPeriodStart(period);
      if (start) filtered = filtered.filter(o => o.created_date && new Date(o.created_date) >= start);
    }
    return filtered;
  }, [allOrders, session, period, customFrom, customTo]);

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    initialData: [],
  });

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const paidOrders = orders.filter(o => o.payment_status === 'paid');
  const pendingOrders = orders.filter(o => o.order_status === 'pending' || o.order_status === 'in_progress');

  // Last 7 days chart
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayOrders = orders.filter(o => o.created_date && format(new Date(o.created_date), 'yyyy-MM-dd') === dateStr);
    last7.push({
      day: format(d, 'EEE'),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((s, o) => s + (o.total_price || 0), 0),
    });
  }

  const recentOrders = orders.slice(0, 5);

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
        <StatCard title="إجمالي الطلبات" value={orders.length} subtitle={`${pendingOrders.length} قيد الانتظار`} icon={ShoppingBag} accentClass="bg-primary" />
        <StatCard title="الإيرادات" value={`${totalRevenue.toFixed(0)} ر.س`} subtitle={`${paidOrders.length} طلب مدفوع`} icon={Wallet} accentClass="bg-primary" />
        <StatCard title="العملاء" value={customers.length} icon={Users} accentClass="bg-primary" />
        <StatCard title="نسبة الإنجاز" value={orders.length ? `${Math.round((orders.filter(o => o.order_status === 'completed').length / orders.length) * 100)}%` : '0%'} icon={TrendingUp} accentClass="bg-primary" />
      </div>

      {session?.role === 'admin' && (
        <div className="mb-8">
          <FinancialReport orders={orders} />
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
              recentOrders.map(o => (
                <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                  <div>
                    <p className="text-sm font-medium">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{o.order_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{o.total_price?.toFixed(0)} SAR</p>
                    <Badge variant="outline" className="text-[10px]">
                      {o.order_status}
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