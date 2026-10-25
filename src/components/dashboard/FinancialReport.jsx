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
          <div className="bg-muted/50 border border-border rounded-xl p-3 text-start">
            <Banknote className="w-4 h-4 text-foreground mb-1" />
            <p className="text-[11px] text-foreground font-medium">إجمالي النقد</p>
            <p className="text-lg font-bold text-foreground">{cashTotal.toFixed(0)}</p>
            <p className="text-[10px] text-foreground">ر.س</p>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-3 text-start">
            <CreditCard className="w-4 h-4 text-foreground mb-1" />
            <p className="text-[11px] text-foreground font-medium">إجمالي الشبكة</p>
            <p className="text-lg font-bold text-foreground">{networkTotal.toFixed(0)}</p>
            <p className="text-[10px] text-foreground">ر.س</p>
          </div>
          <div className="bg-primary text-primary-foreground p-3 text-start">
            <Wallet className="w-4 h-4 mb-1" />
            <p className="text-[11px] font-medium opacity-80">الإجمالي</p>
            <p className="text-lg font-bold">{grandTotal.toFixed(0)}</p>
            <p className="text-[10px] opacity-70">ر.س</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-start">* الطلبات الملغاة مستبعدة من الحساب</p>
      </CardContent>
    </Card>
  );
}