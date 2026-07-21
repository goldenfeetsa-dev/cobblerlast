import React, { useState, useMemo } from 'react';
import { db } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, ExternalLink, Calendar, Building2, User, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { unifyTransactions } from '@/lib/analytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ACTION_LABELS = {
  create: { label: 'إنشاء', class: 'bg-emerald-100 text-emerald-700' },
  update: { label: 'تعديل', class: 'bg-blue-100 text-blue-700' },
  delete: { label: 'حذف', class: 'bg-red-100 text-red-700' },
  status_change: { label: 'تغيير حالة', class: 'bg-amber-100 text-amber-700' },
};

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

const KIND_LABELS = {
  repair: { label: 'إصلاح', class: 'bg-indigo-100 text-indigo-700' },
  sale: { label: 'بيع منتج', class: 'bg-cyan-100 text-cyan-700' },
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
  const [branchFilter, setBranchFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders-audit'],
    queryFn: () => db.Order.list('-created_at', 500),
  });

  // فواتير بيع المنتجات — كانت مفقودة بالكامل من هذي اللوحة سابقاً، مع أنها
  // إيراد فعلي للمتجر مثل طلبات الإصلاح تماماً
  const { data: salesInvoices = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-invoices-audit'],
    queryFn: () => db.SalesInvoice.list('-created_at', 500),
  });

  // سجل النشاط الحقيقي — كل حركة (إنشاء/تعديل/حذف) مسجّلة بمعرفة مين
  // سواها وبأي صفحة، بعكس الجدول المالي تحت اللي يعرض فقط الطلبات والفواتير
  const { data: activityLogs = [], isLoading: activityLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => db.AuditLog.list('-created_at', 300),
  });

  if (!['admin','owner','manager'].includes(session?.role)) return <Navigate to="/pos" replace />;

  const isLoading = ordersLoading || salesLoading;
  const periodStart = getPeriodStart(period);

  // كل العمليات (إصلاح + بيع) موحّدة بمصفوفة واحدة — هذا أساس دقة الأرقام
  const allTransactions = useMemo(
    () => unifyTransactions(orders, salesInvoices),
    [orders, salesInvoices]
  );

  const branches = [...new Set(allTransactions.map(t => t.branch_name).filter(Boolean))];
  const uniqueEmployees = [...new Set(allTransactions.map(t => t.employee_name).filter(Boolean))];

  const filtered = allTransactions.filter(t => {
    // فلترة الفرع للموظفين غير الإداريين — كل موظف يرى فرعه فقط
    if (!['admin','owner','manager'].includes(session?.role) && session?.branch_id) {
      if (t.branch_id && t.branch_id !== session.branch_id) return false;
    }
    if (branchFilter !== 'all' && t.branch_name !== branchFilter) return false;
    if (kindFilter !== 'all' && t.kind !== kindFilter) return false;

    if (period === 'custom') {
      const d = t.created_at ? new Date(t.created_at) : null;
      if (customFrom && d && d < new Date(customFrom + 'T00:00:00')) return false;
      if (customTo && d && d > new Date(customTo + 'T23:59:59')) return false;
    } else if (periodStart && t.created_at && new Date(t.created_at) < periodStart) {
      return false;
    }

    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (employeeFilter !== 'all' && t.employee_name !== employeeFilter) return false;

    if (search) {
      const q = search.toLowerCase();
      return (
        t.number?.toLowerCase().includes(q) ||
        t.raw.customer_name?.toLowerCase().includes(q) ||
        t.raw.customer_phone?.includes(q) ||
        t.employee_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ملخص دقيق — يشمل الآن إيراد المبيعات مع إيراد الإصلاح معاً
  const totalRevenue = filtered.reduce((s, t) => s + (t.amount || 0), 0);
  const cashTotal = filtered.filter(t => t.payment_method === 'cash').reduce((s, t) => s + (t.amount || 0), 0);
  const networkTotal = filtered.filter(t => t.payment_method === 'network').reduce((s, t) => s + (t.amount || 0), 0);
  const paidCount = filtered.filter(t => t.payment_status === 'paid').length;
  const unpaidCount = filtered.filter(t => t.payment_status === 'unpaid').length;
  const repairRevenue = filtered.filter(t => t.kind === 'repair').reduce((s, t) => s + (t.amount || 0), 0);
  const saleRevenue = filtered.filter(t => t.kind === 'sale').reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">لوحة التدقيق</h1>
          <p className="text-sm text-muted-foreground">مراجعة شاملة لكل عمليات الإصلاح والبيع معاً</p>
        </div>
      </div>

      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="financial" className="gap-1.5"><ClipboardList className="w-4 h-4" />الحركات المالية</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity className="w-4 h-4" />سجل النشاط ({activityLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="financial">

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-primary">{filtered.length}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي العمليات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-emerald-600">{totalRevenue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-1">الإيراد الكلي (ر.س)</p>
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

      {/* Revenue split — repair vs sale, so nothing is hidden anymore */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="border-indigo-100">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-black text-indigo-700">{repairRevenue.toFixed(0)} ر.س</p>
            <p className="text-xs text-muted-foreground mt-0.5">إيراد الإصلاح</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-100">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-black text-cyan-700">{saleRevenue.toFixed(0)} ر.س</p>
            <p className="text-xs text-muted-foreground mt-0.5">إيراد بيع المنتجات</p>
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
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="نوع العملية" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="repair">إصلاح فقط</SelectItem>
            <SelectItem value="sale">بيع منتج فقط</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="الفرع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفروع</SelectItem>
            {branches.map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">رقم العملية</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">النوع</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">العميل</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الفرع</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الموظف</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">المبلغ</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الدفع</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الحالة</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">التاريخ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, idx) => {
                  const status = STATUS_LABELS[t.status] || { label: t.status || '—', class: 'bg-gray-100 text-gray-700' };
                  const payment = PAYMENT_LABELS[t.payment_status] || { label: t.payment_status || '—', class: 'bg-gray-100' };
                  const kind = KIND_LABELS[t.kind];
                  const detailLink = t.kind === 'repair' ? `/orders/${t.raw.id}` : '/invoices';
                  return (
                    <tr key={t.id} className={`border-b transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 font-mono font-bold text-xs">{t.number}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${kind.class}`}>{kind.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.raw.customer_name || '—'}</div>
                        {t.raw.customer_phone && <div className="text-xs text-muted-foreground" dir="ltr">{t.raw.customer_phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{t.branch_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t.employee_name || '—'}</td>
                      <td className="px-4 py-3 font-bold">{t.amount?.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">ر.س</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge className={`text-[10px] w-fit ${payment.class}`}>{payment.label}</Badge>
                          <span className="text-[10px] text-muted-foreground">{t.payment_method === 'cash' ? 'نقد' : t.payment_method === 'network' ? 'شبكة' : '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${status.class}`}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {t.created_at ? format(new Date(t.created_at), 'yyyy/MM/dd HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={detailLink} className="text-primary hover:text-primary/70 transition-colors">
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
        </TabsContent>

        <TabsContent value="activity">
          {activityLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>ما فيه حركات مسجّلة بعد</p>
              <p className="text-xs mt-1">سيبدأ التسجيل تلقائياً مع أي إنشاء/تعديل/حذف جديد بالنظام</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الحساب</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الدور</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">الصفحة</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">نوع الحركة</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">العنصر</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((log, idx) => {
                      const action = ACTION_LABELS[log.action] || { label: log.action || '—', class: 'bg-gray-100 text-gray-700' };
                      return (
                        <tr key={log.id} className={`border-b transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              {log.employee_name || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{log.employee_role || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{log.page || '—'}</td>
                          <td className="px-4 py-3"><Badge className={`text-[10px] ${action.class}`}>{action.label}</Badge></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {log.entity || '—'}{log.entity_id ? ` · ${String(log.entity_id).slice(0, 8)}` : ''}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {log.created_at ? format(new Date(log.created_at), 'yyyy/MM/dd HH:mm') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
