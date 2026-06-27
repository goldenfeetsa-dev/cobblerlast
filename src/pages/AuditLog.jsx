import React, { useState } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, ExternalLink, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS = {
  pending: { label: 'قيد الانتظار', class: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'جارٍ التنفيذ', class: 'bg-blue-100 text-blue-700' },
  ready: { label: 'جاهز', class: 'bg-green-100 text-green-700' },
  completed: { label: 'مكتمل', class: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'ملغى', class: 'bg-red-100 text-red-700' },
  returned: { label: 'مُسترجع', class: 'bg-orange-100 text-orange-700' },
  exchanged: { label: 'مُستبدَل', class: 'bg-purple-100 text-purple-700' },
  on_hold: { label: 'متوقف', class: 'bg-yellow-100 text-yellow-700' },
};

const PAYMENT_LABELS = {
  paid: { label: 'مدفوع', class: 'bg-green-100 text-green-700' },
  unpaid: { label: 'غير مدفوع', class: 'bg-red-100 text-red-700' },
};

const ITEM_LABELS = {
  shoes: 'أحذية', bag: 'حقيبة', dress: 'فستان', suit: 'بدلة',
  jacket: 'جاكيت', pants: 'بنطال', shirt: 'قميص', other: 'أخرى'
};

const PERIODS = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'هذا الأسبوع' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'year', label: 'هذه السنة' },
  { key: 'custom', label: 'تاريخ محدد' },
  { key: 'all', label: 'الكل' },
];

function getPeriodStart(key) {
  const now = new Date();
  if (key === 'today') { now.setHours(0, 0, 0, 0); return now; }
  if (key === 'week') { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; }
  if (key === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1); }
  if (key === 'year') { return new Date(now.getFullYear(), 0, 1); }
  return null;
}

export default function AuditLog() {
  const session = getSession();
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-audit'],
    queryFn: () => base44.entities.Order.list('-created_at', 500),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  if (session?.role !== 'admin') return <Navigate to="/" replace />;

  const periodStart = getPeriodStart(period);

  const filtered = orders.filter(o => {
    // Branch filter for staff
    if (session?.role !== 'admin' && session?.branch_id) {
      if (o.branch_id && o.branch_id !== session.branch_id) return false;
    }
    if (period === 'custom') {
      const orderDate = o.created_at ? new Date(o.created_at) : null;
      if (customFrom && orderDate && orderDate < new Date(customFrom + 'T00:00:00')) return false;
      if (customTo && orderDate && orderDate > new Date(customTo + 'T23:59:59')) return false;
    } else {
      if (periodStart && o.created_at && new Date(o.created_at) < periodStart) return false;
    }
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (employeeFilter !== 'all' && o.employee_name !== employeeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q) ||
        o.employee_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Summary stats
  const validOrders = filtered.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
  const totalRevenue = validOrders.reduce((s, o) => s + (o.total_price || 0), 0);
  const cashTotal = validOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_price || 0), 0);
  const networkTotal = validOrders.filter(o => o.payment_method === 'network').reduce((s, o) => s + (o.total_price || 0), 0);
  const paidCount = filtered.filter(o => o.payment_status === 'paid').length;
  const unpaidCount = filtered.filter(o => o.payment_status === 'unpaid').length;

  const uniqueEmployees = [...new Set(orders.map(o => o.employee_name).filter(Boolean))];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">لوحة التدقيق</h1>
          <p className="text-sm text-muted-foreground">مراجعة شاملة لجميع الطلبات والعمليات</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-primary">{filtered.length}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الطلبات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-emerald-600">{totalRevenue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-1">الإيراد (ر.س)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-green-600">{cashTotal.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-1">نقد (ر.س)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-blue-600">{networkTotal.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-1">شبكة (ر.س)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${period === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex gap-3 mb-3 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">من:</span>
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">إلى:</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-40" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="الموظف" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الموظفين</SelectItem>
            {uniqueEmployees.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Paid/Unpaid summary */}
      <div className="flex gap-3 mb-5">
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{paidCount} مدفوع</span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">{unpaidCount} غير مدفوع</span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{filtered.length} إجمالي</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>لا توجد نتائج</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">رقم الطلب</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">العميل</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الموظف</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">القطعة</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">المبلغ</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الدفع</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الحالة</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">التاريخ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, idx) => {
                  const status = STATUS_LABELS[o.status] || { label: o.status, class: 'bg-gray-100 text-gray-700' };
                  const payment = PAYMENT_LABELS[o.payment_status] || { label: o.payment_status, class: 'bg-gray-100' };
                  return (
                    <tr key={o.id} className={`border-b transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 font-mono font-bold text-xs">{o.order_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.customer_name}</div>
                        {o.customer_phone && <div className="text-xs text-muted-foreground" dir="ltr">{o.customer_phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.employee_name || '—'}</td>
                      <td className="px-4 py-3">{ITEM_LABELS[o.item_type] || o.item_type} × {o.quantity || 1}</td>
                      <td className="px-4 py-3 font-bold">{o.total_price?.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">ر.س</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge className={`text-[10px] w-fit ${payment.class}`}>{payment.label}</Badge>
                          <span className="text-[10px] text-muted-foreground">{o.payment_method === 'cash' ? 'نقد' : o.payment_method === 'network' ? 'شبكة' : '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${status.class}`}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {o.created_at ? format(new Date(o.created_at), 'yyyy/MM/dd HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/orders/${o.id}`} className="text-primary hover:text-primary/70 transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}