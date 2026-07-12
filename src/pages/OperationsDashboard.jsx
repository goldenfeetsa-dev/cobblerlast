import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Factory, Truck, ArrowLeftRight, CheckCircle2, Bell, Package,
  ShieldCheck, Zap, ZapOff, Building2, TrendingUp,
  Users, ShoppingBag, AlertCircle, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const STAGES = [
  { key: 'reception',          label: 'الاستلام',            icon: Package,        color: 'bg-blue-100 text-blue-700',    border: 'border-blue-200' },
  { key: 'logistics_out',      label: 'إرسال للمصنع',        icon: Truck,          color: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
  { key: 'factory_processing', label: 'الإصلاح في المصنع',   icon: Factory,        color: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
  { key: 'quality_check',      label: 'فحص الجودة',          icon: CheckCircle2,   color: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200' },
  { key: 'logistics_return',   label: 'الإرجاع للفرع',       icon: ArrowLeftRight, color: 'bg-teal-100 text-teal-700',    border: 'border-teal-200' },
  { key: 'ready_for_pickup',   label: 'جاهز للاستلام',       icon: Bell,           color: 'bg-green-100 text-green-700',  border: 'border-green-200' },
];

const STAGE_NEXT = {
  reception: 'logistics_out',
  logistics_out: 'factory_processing',
  factory_processing: 'quality_check',
  quality_check: 'logistics_return',
  logistics_return: 'ready_for_pickup',
};

function PlanBMasterSwitch({ plan, onToggle, loading }) {
  const enabled = plan?.plan_b_enabled || false;
  return (
    <div className={`rounded-2xl border-2 p-5 flex items-center justify-between gap-4 transition-all ${
      enabled ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${enabled ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          {enabled ? <Zap className="w-6 h-6" /> : <ZapOff className="w-6 h-6 text-muted-foreground" />}
        </div>
        <div>
          <h3 className="font-bold text-base">الخطة الثانية — Operations Workflow</h3>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? '✅ مفعّلة — الطلبات تُحوَّل تلقائياً للمصنع المركزي'
              : '⏸️ معطّلة — الطلبات تُعالَج داخل الفرع مباشرةً'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold ${enabled ? 'text-primary' : 'text-muted-foreground'}`}>
          {enabled ? 'مفعّلة' : 'معطّلة'}
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={loading}
          className="data-[state=checked]:bg-primary"
        />
      </div>
    </div>
  );
}

function BranchCard({ branchName, orders }) {
  const inbound  = orders.filter(o => ['pending','in_progress'].includes(o.status)).length;
  const outbound = orders.filter(o => o.status === 'ready').length;
  const done     = orders.filter(o => o.status === 'completed').length;
  const revenue  = orders.reduce((s, o) => s + (o.total_price || 0), 0);
  const productivity = orders.length ? Math.round((done / orders.length) * 100) : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-bold truncate">{branchName || 'الفرع الرئيسي'}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 bg-blue-50">
            <p className="text-xs text-blue-600 mb-0.5">داخل (قيد الإصلاح)</p>
            <p className="text-2xl font-black text-blue-700">{inbound}</p>
          </div>
          <div className="rounded-xl p-3 bg-green-50">
            <p className="text-xs text-green-600 mb-0.5">خارج (جاهزة)</p>
            <p className="text-2xl font-black text-green-700">{outbound}</p>
          </div>
          <div className="rounded-xl p-3 bg-muted/50">
            <p className="text-xs text-muted-foreground mb-0.5">الإيرادات</p>
            <p className="text-base font-bold">{revenue.toFixed(0)} ر.س</p>
          </div>
          <div className="rounded-xl p-3 bg-muted/50">
            <p className="text-xs text-muted-foreground mb-0.5">الإنتاجية</p>
            <div className="flex items-center gap-1">
              <p className="text-base font-bold">{productivity}%</p>
              <TrendingUp className="w-3 h-3 text-primary" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>إجمالي الطلبات: <strong className="text-foreground">{orders.length}</strong></span>
          <span>مكتملة: <strong className="text-foreground">{done}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowPipeline({ workflows, onAdvance, advancingId }) {
  if (workflows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Factory className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">لا توجد طلبات في خط الإنتاج</p>
        <p className="text-xs mt-1">فعّل الخطة الثانية لبدء تحويل الطلبات</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workflows.map(wf => {
        const stageInfo = STAGES.find(s => s.key === wf.stage) || STAGES[0];
        const StageIcon = stageInfo.icon;
        const nextStage = STAGE_NEXT[wf.stage];
        const nextInfo = STAGES.find(s => s.key === nextStage);
        const isLast = wf.stage === 'ready_for_pickup';

        return (
          <div key={wf.id} className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${stageInfo.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stageInfo.color}`}>
                <StageIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{wf.order_number}</span>
                  <Badge className={`text-[10px] ${stageInfo.color} border-0`}>{stageInfo.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{wf.customer_name} · {wf.customer_phone}</p>
                {wf.branch_name && <p className="text-xs text-muted-foreground">الفرع: {wf.branch_name}</p>}
                {wf.technician_name && <p className="text-xs text-muted-foreground">الفني: {wf.technician_name}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {wf.stage === 'ready_for_pickup' && wf.customer_phone && (
                <a
                  href={`https://wa.me/${wf.customer_phone.replace(/^0/, '966').replace(/\D/g, '')}?text=${encodeURIComponent(`يا هلا ${wf.customer_name}! 🎉\nطلبك رقم ${wf.order_number} جاهز للاستلام من فرع ${wf.branch_name}.\nإبرة وخيط الإسكافي ✂️`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="bg-[#25D366] hover:bg-[#20bb5a] text-white text-xs gap-1">
                    <Bell className="w-3 h-3" />
                    إشعار العميل
                  </Button>
                </a>
              )}
              {!isLast && nextInfo && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={advancingId === wf.id}
                  onClick={() => onAdvance(wf)}
                  className="text-xs gap-1"
                >
                  {advancingId === wf.id ? 'جاري...' : (
                    <>التالي: {nextInfo.label} <ChevronRight className="w-3 h-3" /></>
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LoyaltyStats({ customers, freeAfter }) {
  const eligibleNow = customers.filter(c => (c.stamps || 0) >= freeAfter).length;
  const nearFree    = customers.filter(c => {
    const s = c.stamps || 0;
    return s >= freeAfter - 1 && s < freeAfter;
  }).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl p-4 bg-primary/5 border border-primary/20 text-center">
        <p className="text-2xl font-black text-primary">{eligibleNow}</p>
        <p className="text-xs text-muted-foreground mt-1">يستحق خدمة مجانية الآن</p>
      </div>
      <div className="rounded-xl p-4 bg-yellow-50 border border-yellow-200 text-center">
        <p className="text-2xl font-black text-yellow-600">{nearFree}</p>
        <p className="text-xs text-muted-foreground mt-1">يقترب من المجاني</p>
      </div>
      <div className="rounded-xl p-4 bg-muted/50 border text-center">
        <p className="text-2xl font-black">{freeAfter}</p>
        <p className="text-xs text-muted-foreground mt-1">خدمات للحصول على مجانية</p>
      </div>
    </div>
  );
}

export default function OperationsDashboard() {
  const session = getSession();
  const queryClient = useQueryClient();
  const [advancingId, setAdvancingId] = useState(null);
  const [techInput, setTechInput] = useState({});
  const [branchFilter, setBranchFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  const { data: planList } = useQuery({
    queryKey: ['operations-plan'],
    queryFn: () => base44.entities.OperationsPlan.list(),
    initialData: [],
  });
  const plan = planList[0] || null;

  const { data: workflows, isLoading: wfLoading } = useQuery({
    queryKey: ['workflow-stages'],
    queryFn: () => base44.entities.WorkflowStage.list('-created_at', 100),
    initialData: [],
    refetchInterval: 15000,
  });

  const { data: allOrders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_at', 300),
    initialData: [],
    refetchInterval: 20000,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    initialData: [],
  });

  const { data: settingsList } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSettings.list(), staleTime: 0,
    initialData: [],
  });
  const freeAfter = plan?.loyalty_free_after || settingsList[0]?.stamps_required || 3;

  // Group orders by branch
  const branchMap = useMemo(() => {
    const map = {};
    allOrders.forEach(o => {
      const key = o.branch_name || 'الفرع الرئيسي';
      if (!map[key]) map[key] = [];
      map[key].push(o);
    });
    return map;
  }, [allOrders]);

  // Unique branches from workflows
  const workflowBranches = useMemo(() => {
    const names = [...new Set(workflows.map(w => w.branch_name || 'الفرع الرئيسي'))];
    return names;
  }, [workflows]);

  // Filtered workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter(w => {
      const branchOk = branchFilter === 'all' || (w.branch_name || 'الفرع الرئيسي') === branchFilter;
      const stageOk  = stageFilter === 'all' || w.stage === stageFilter;
      return branchOk && stageOk;
    });
  }, [workflows, branchFilter, stageFilter]);

  // Active workflows only (not completed)
  const activeWorkflows = filteredWorkflows.filter(w => w.stage !== 'ready_for_pickup');
  const completedWorkflows = filteredWorkflows.filter(w => w.stage === 'ready_for_pickup');

  // Group active workflows by branch
  const workflowsByBranch = useMemo(() => {
    const map = {};
    activeWorkflows.forEach(w => {
      const key = w.branch_name || 'الفرع الرئيسي';
      if (!map[key]) map[key] = [];
      map[key].push(w);
    });
    return map;
  }, [activeWorkflows]);

  // Summary stats
  const totalInbound  = allOrders.filter(o => ['pending','in_progress'].includes(o.status)).length;
  const totalOutbound = allOrders.filter(o => o.status === 'ready').length;
  const atFactory     = workflows.filter(w => ['factory_processing','quality_check'].includes(w.stage)).length;

  const planMutation = useMutation({
    mutationFn: async (enabled) => {
      const data = { plan_b_enabled: enabled, updated_by: session?.name || 'admin' };
      if (plan) return base44.entities.OperationsPlan.update(plan.id, data);
      return base44.entities.OperationsPlan.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations-plan'] });
      toast.success(plan?.plan_b_enabled ? 'تم إيقاف الخطة الثانية' : 'تم تفعيل الخطة الثانية ✅');
    },
  });

  const advanceMutation = useMutation({
    mutationFn: async ({ wf }) => {
      const nextStage = STAGE_NEXT[wf.stage];
      const updates = { stage: nextStage };
      if (nextStage === 'logistics_out') updates.dispatched_to_factory_at = new Date().toISOString();
      if (nextStage === 'logistics_return') updates.returned_to_branch_at = new Date().toISOString();
      if (nextStage === 'ready_for_pickup') updates.notified_customer_at = new Date().toISOString();
      if (techInput[wf.id]) updates.technician_name = techInput[wf.id];
      return base44.entities.WorkflowStage.update(wf.id, updates);
    },
    onSuccess: (_, { wf }) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-stages'] });
      const nextStage = STAGE_NEXT[wf.stage];
      const nextLabel = STAGES.find(s => s.key === nextStage)?.label;
      toast.success(`تم التقدم إلى: ${nextLabel}`);
      setAdvancingId(null);
    },
  });

  if (!['admin','owner','manager'].includes(session?.role)) return <Navigate to="/pos" replace />;

  const handleAdvance = (wf) => {
    setAdvancingId(wf.id);
    advanceMutation.mutate({ wf });
  };

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Factory className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">لوحة العمليات — Operations</h1>
          <p className="text-sm text-muted-foreground">
            إدارة الخطة الثانية · الفروع · نظام الولاء · الإنتاجية اللحظية
          </p>
        </div>
        <div className="mr-auto flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5">
          <div className={`w-2 h-2 rounded-full ${plan?.plan_b_enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-xs font-medium">
            {plan?.plan_b_enabled ? 'الخطة الثانية نشطة' : 'الخطة الثانية متوقفة'}
          </span>
        </div>
      </div>

      {/* Master Switch */}
      <div className="mb-6">
        <PlanBMasterSwitch
          plan={plan}
          onToggle={(v) => planMutation.mutate(v)}
          loading={planMutation.isPending}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'إجمالي الطلبات الجارية', value: totalInbound,  icon: ShoppingBag, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'جاهزة للتسليم',           value: totalOutbound, icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'في المصنع الآن',           value: atFactory,     icon: Factory,      color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'إجمالي العملاء',           value: customers.length, icon: Users,     color: 'text-primary',    bg: 'bg-primary/5' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-black">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: Branch Performance + Loyalty */}
        <div className="xl:col-span-1 space-y-5">
          {/* Branches */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                أداء الفروع — لحظي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {Object.entries(branchMap).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات فروع بعد</p>
              ) : (
                Object.entries(branchMap).map(([name, orders]) => (
                  <BranchCard key={name} branchName={name} orders={orders} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Loyalty */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                نظام الولاء 3+1
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <p className="text-xs text-muted-foreground">
                كل <strong>{freeAfter}</strong> عمليات تصليح → الخدمة التالية مجانية. رقم الهاتف هو المفتاح الأساسي للعميل.
              </p>
              <LoyaltyStats customers={customers} freeAfter={freeAfter} />
              <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1 text-muted-foreground">
                <p>🔑 <strong>رقم الهاتف</strong> = Unique ID للعميل</p>
                <p>🎯 بعد كل {freeAfter} إصلاحات تُحتسب خدمة مجانية</p>
                <p>📱 إشعار واتساب تلقائي عند الاستحقاق</p>
                <p>💳 متوافق مع Google Wallet Pass (يحتاج Backend+ للتفعيل الكامل)</p>
              </div>
              <Link to="/customers">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  <Users className="w-3 h-3 ml-1" />
                  عرض جميع العملاء وبطاقاتهم
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Workflow Pipeline */}
        <div className="xl:col-span-2 space-y-5">
          {/* Pipeline stages visual */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-primary" />
                خط سير الطلب — Workflow Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Stage flow diagram */}
              <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-4">
                {STAGES.map((s, i) => {
                  const Icon = s.icon;
                  const count = workflows.filter(w => w.stage === s.key).length;
                  return (
                    <React.Fragment key={s.key}>
                      <div className={`shrink-0 rounded-xl p-2 text-center min-w-[72px] ${count > 0 ? s.color + ' ' + s.border + ' border' : 'bg-muted/40 text-muted-foreground'}`}>
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        <p className="text-[10px] font-bold leading-tight">{s.label}</p>
                        <p className={`text-base font-black mt-0.5 ${count > 0 ? '' : 'text-muted-foreground'}`}>{count}</p>
                      </div>
                      {i < STAGES.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">الفرع:</span>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setBranchFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${branchFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      الكل
                    </button>
                    {workflowBranches.map(b => (
                      <button key={b} onClick={() => setBranchFilter(b)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${branchFilter === b ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">المرحلة:</span>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setStageFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${stageFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      الكل
                    </button>
                    {STAGES.map(s => (
                      <button key={s.key} onClick={() => setStageFilter(s.key)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${stageFilter === s.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active workflows — grouped by branch */}
          {Object.keys(workflowsByBranch).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Factory className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">لا توجد طلبات جارية</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(workflowsByBranch).map(([branchName, wfs]) => (
              <Card key={branchName}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      {branchName}
                      <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{wfs.length} طلب</Badge>
                    </CardTitle>
                    {!plan?.plan_b_enabled && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        <AlertCircle className="w-3 h-3 ml-1" />معطّلة
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <WorkflowPipeline workflows={wfs} onAdvance={handleAdvance} advancingId={advancingId} />
                </CardContent>
              </Card>
            ))
          )}

          {/* Ready for pickup */}
          {completedWorkflows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <Bell className="w-4 h-4" />
                  جاهزة لإشعار العميل ({completedWorkflows.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <WorkflowPipeline workflows={completedWorkflows} onAdvance={handleAdvance} advancingId={advancingId} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Google Wallet Info */}
      <Card className="mt-6 border-dashed border-2 border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-sm mb-2">ربط Google Wallet — خارطة طريق التقنية</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">الآلية التقنية:</p>
                  <p>① رقم الهاتف = Unique Customer ID</p>
                  <p>② بعد كل {freeAfter} إصلاحات → تحديث Pass</p>
                  <p>③ Google Wallet API (JWT Pass Object)</p>
                  <p>④ إرسال Pass URL للعميل عبر واتساب/SMS</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">متطلبات التفعيل الكامل:</p>
                  <p>• Google Pay & Wallet Console (مجاني)</p>
                  <p>• Service Account JSON (للتوقيع)</p>
                  <p>• Backend Function لتوليد JWT</p>
                  <p>• Issuer ID من Google Console</p>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs">
                💡 <strong>الخطوة العملية الآن:</strong> كل عميل يصل إلى {freeAfter} طوابع يظهر في لوحة الولاء أعلاه ويمكن إشعاره عبر واتساب بالخدمة المجانية. ربط Google Wallet يحتاج Backend+ (خادم) لتوليد JWT Pass.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}