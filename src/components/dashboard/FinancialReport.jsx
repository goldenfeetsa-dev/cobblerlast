import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Banknote, CreditCard } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';

const PERIODS = [
  { key: 'daily', label: 'اليوم', fn: () => startOfDay(new Date()) },
  { key: 'weekly', label: 'الأسبوع', fn: () => startOfWeek(new Date(), { weekStartsOn: 0 }) },
  { key: 'monthly', label: 'الشهر', fn: () => startOfMonth(new Date()) },
  { key: 'yearly', label: 'السنة', fn: () => startOfYear(new Date()) },
];

export default function FinancialReport({ orders }) {
  const [period, setPeriod] = useState('daily');

  const periodStart = PERIODS.find(p => p.key === period).fn();

  const validOrders = orders.filter(o => {
    if (o.status === 'cancelled' || o.status === 'returned') return false;
    if (!o.created_at) return false;
    return new Date(o.created_at) >= periodStart;
  });

  const cashTotal = validOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_price || 0), 0);
  const networkTotal = validOrders.filter(o => o.payment_method === 'network').reduce((s, o) => s + (o.total_price || 0), 0);
  const grandTotal = cashTotal + networkTotal;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          التقرير المالي
        </CardTitle>
        <div className="flex gap-2 flex-wrap mt-2">
          {PERIODS.map(p => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? 'default' : 'outline'}
              className={period === p.key ? 'bg-primary text-primary-foreground' : ''}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <Banknote className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-[11px] text-green-700 font-medium">إجمالي النقد</p>
            <p className="text-lg font-bold text-green-800">{cashTotal.toFixed(0)}</p>
            <p className="text-[10px] text-green-600">ر.س</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <CreditCard className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <p className="text-[11px] text-blue-700 font-medium">إجمالي الشبكة</p>
            <p className="text-lg font-bold text-blue-800">{networkTotal.toFixed(0)}</p>
            <p className="text-[10px] text-blue-600">ر.س</p>
          </div>
          <div className="bg-primary/10 rounded-xl p-3 text-center">
            <Wallet className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-[11px] text-primary font-medium">الإجمالي</p>
            <p className="text-lg font-bold text-primary">{grandTotal.toFixed(0)}</p>
            <p className="text-[10px] text-primary/70">ر.س</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">* الطلبات الملغاة مستبعدة من الحساب</p>
      </CardContent>
    </Card>
  );
}