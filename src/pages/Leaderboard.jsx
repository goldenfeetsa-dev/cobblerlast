import React, { useState } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Crown, TrendingUp, ShoppingBag, Wallet, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, startOfDay, startOfMonth, startOfYear } from 'date-fns';

const PERIODS = [
  { key: 'daily',   label: 'اليوم' },
  { key: 'monthly', label: 'الشهر' },
  { key: 'yearly',  label: 'السنة' },
  { key: 'all',     label: 'الكل' },
];

export default function Leaderboard() {
  const session = getSession();
  const [period, setPeriod] = useState('monthly');

  const { data: employees, isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
    initialData: [],
  });

  const { data: orders } = useQuery({
    queryKey: ['orders-leaderboard'],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
    initialData: [],
  });

  if (session?.role !== 'admin') return <Navigate to="/" replace />;

  // Filter orders by period
  const now = new Date();
  const cutoff = period === 'daily'   ? startOfDay(now)
               : period === 'monthly' ? startOfMonth(now)
               : period === 'yearly'  ? startOfYear(now)
               : null;

  const filteredOrders = cutoff
    ? orders.filter(o => o.created_date && new Date(o.created_date) >= cutoff)
    : orders;

  // Aggregate per employee
  const empStats = employees.map(emp => {
    const empOrders = filteredOrders.filter(o => o.employee_id === emp.id || o.employee_name === emp.name);
    const revenue = empOrders.reduce((s, o) => s + (o.total_price || 0), 0);
    return { ...emp, period_orders: empOrders.length, period_revenue: revenue };
  });

  const sorted = [...empStats].sort((a, b) => b.period_orders - a.period_orders);

  const chartData = sorted.slice(0, 8).map(e => ({
    name: e.name?.split(' ')[0] || '—',
    طلبات: e.period_orders,
    إيرادات: Math.round(e.period_revenue),
  }));

  const rankIcons = [
    <Crown key="1" className="w-5 h-5 text-amber-500" />,
    <Medal key="2" className="w-5 h-5 text-gray-400" />,
    <Medal key="3" className="w-5 h-5 text-amber-700" />,
  ];

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">لوحة المتصدرين</h1>
            <p className="text-sm text-muted-foreground">ترتيب أداء الموظفين</p>
          </div>
        </div>

        {/* Period switcher */}
        <div className="flex rounded-xl border border-border p-1 bg-muted/30 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                period === p.key
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
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
        <div className="space-y-5">
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

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                الطلبات حسب الموظف
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="طلبات" fill="hsl(38,80%,50%)" radius={[5,5,0,0]} />
                    <Bar dataKey="إيرادات" fill="hsl(38,80%,75%)" radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Rankings */}
          <div className="space-y-2">
            {sorted.map((emp, i) => (
              <Card key={emp.id} className={`transition-all ${i === 0 && emp.period_orders > 0 ? 'border-primary/40 bg-primary/5' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold shrink-0">
                      {i < 3 && emp.period_orders > 0 ? rankIcons[i] : (
                        <span className="text-xs text-muted-foreground font-bold">#{i + 1}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.branch_name || 'الفرع الرئيسي'}</p>
                    </div>
                  </div>
                  <div className="flex gap-5 text-sm">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-bold">{emp.period_orders}</span>
                      <span className="text-muted-foreground text-xs">طلب</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-bold">{emp.period_revenue.toFixed(0)}</span>
                      <span className="text-muted-foreground text-xs">ر.س</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}