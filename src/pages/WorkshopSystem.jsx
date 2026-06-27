import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Wrench, Package, CheckCircle2, AlertCircle, Plus,
  ClipboardList, Calculator, ShieldCheck, TrendingDown
} from 'lucide-react';
import { format } from 'date-fns';

const UNITS = { piece: 'حبة', dozen: 'درزن', carton: 'كرتون', kg: 'كغ', liter: 'لتر' };

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTHS_AR[parseInt(m) - 1]} ${y}`;
}

// ─── Withdrawal Tab (Technician view) ─────────────────────────────────────────
function WithdrawalTab({ items, session }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ item_id: '', qty: '', notes: '' });
  const workshopItems = items.filter(i => i.category === 'workshop' || i.category === 'both');
  const selectedItem = workshopItems.find(i => i.id === form.item_id);
  const monthKey = format(new Date(), 'yyyy-MM');

  const { data: myWithdrawals } = useQuery({
    queryKey: ['workshop-custody', session?.name, monthKey],
    queryFn: () => base44.entities.WorkshopCustody.filter({ technician_name: session?.name, month_key: monthKey }),
    initialData: [],
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      if (!form.item_id || !form.qty) throw new Error('اختر المادة وأدخل الكمية');
      const item = workshopItems.find(i => i.id === form.item_id);
      const qty = parseFloat(form.qty);
      if ((item?.workshop_qty || 0) < qty) throw new Error('الكمية في مخزن الورشة غير كافية');

      await base44.entities.WorkshopCustody.create({
        technician_name: session?.name || 'فني',
        item_id: form.item_id,
        item_name: item.name,
        unit: item.unit,
        quantity_withdrawn: qty,
        cost_price: item.cost_price,
        total_cost: qty * item.cost_price,
        notes: form.notes,
        month_key: monthKey,
        settled: false,
      });

      // Deduct from workshop stock
      await base44.entities.InventoryItem.update(form.item_id, {
        workshop_qty: Math.max(0, (item.workshop_qty || 0) - qty),
      });

      // Movement record
      await base44.entities.StockMovement.create({
        item_id: form.item_id, item_name: item.name,
        movement_type: 'workshop_withdrawal',
        quantity: qty, unit: item.unit,
        from_location: 'workshop', to_location: session?.name || 'فني',
        cost_price: item.cost_price, reference_type: 'manual',
        created_by_name: session?.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-custody'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('تم تسجيل السحب ✅');
      setForm({ item_id: '', qty: '', notes: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  const myTotal = myWithdrawals.reduce((s, w) => s + (w.total_cost || 0), 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            تسجيل سحب مواد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <Label>المادة</Label>
              <Select value={form.item_id} onValueChange={v => setForm(p => ({...p, item_id: v}))}>
                <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                <SelectContent>
                  {workshopItems.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.workshop_qty || 0} {UNITS[i.unit] || i.unit} متاح)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>الكمية</Label>
              <Input type="number" min={0.1} step={0.1} value={form.qty} onChange={e => setForm(p => ({...p, qty: e.target.value}))} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>ملاحظات</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="اختياري" />
            </div>
          </div>
          {selectedItem && form.qty && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm flex items-center justify-between">
              <span>التكلفة التقديرية:</span>
              <span className="font-bold">{(parseFloat(form.qty) * selectedItem.cost_price).toFixed(2)} ر.س</span>
            </div>
          )}
          <Button disabled={!form.item_id || !form.qty || withdraw.isPending} onClick={() => withdraw.mutate()}>
            {withdraw.isPending ? 'جاري...' : 'تسجيل السحب'}
          </Button>
        </CardContent>
      </Card>

      {/* This month withdrawals */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              مسحوباتي — {monthLabel(monthKey)}
            </CardTitle>
            <Badge className="bg-primary/10 text-primary border-0">
              الإجمالي: {myTotal.toFixed(2)} ر.س
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {myWithdrawals.map(w => (
              <div key={w.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{w.item_name}</p>
                  <p className="text-xs text-muted-foreground">{w.quantity_withdrawn} {UNITS[w.unit] || w.unit} · {w.notes}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold">{w.total_cost?.toFixed(2)} ر.س</p>
                  <Badge variant={w.settled ? 'default' : 'outline'} className="text-[10px]">
                    {w.settled ? 'تمت التسوية' : 'قيد الانتظار'}
                  </Badge>
                </div>
              </div>
            ))}
            {myWithdrawals.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">لا توجد مسحوبات هذا الشهر</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Settlement Tab (Admin only) ──────────────────────────────────────────────
function SettlementTab({ items, session }) {
  const queryClient = useQueryClient();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [settleItems, setSettleItems] = useState([]);
  const [notes, setNotes] = useState('');

  const { data: allCustody } = useQuery({
    queryKey: ['workshop-custody-all'],
    queryFn: () => base44.entities.WorkshopCustody.list('-created_at', 500),
    initialData: [],
  });

  const { data: salesInvoices } = useQuery({
    queryKey: ['sales-invoices'],
    queryFn: () => base44.entities.SalesInvoice.list('-created_at', 500),
    initialData: [],
  });

  const { data: settlements } = useQuery({
    queryKey: ['workshop-settlements'],
    queryFn: () => base44.entities.WorkshopSettlement.list('-created_at', 24),
    initialData: [],
  });

  const workshopItems = items.filter(i => i.category === 'workshop' || i.category === 'both');

  // Pre-fill settlement items from this month's custody withdrawals
  const monthCustody = allCustody.filter(c => c.month_key === selectedMonth && !c.settled);
  const custodyByItem = useMemo(() => {
    const map = {};
    monthCustody.forEach(c => {
      if (!map[c.item_id]) map[c.item_id] = { item_id: c.item_id, item_name: c.item_name, unit: c.unit, cost_price: c.cost_price, withdrawn_qty: 0 };
      map[c.item_id].withdrawn_qty += c.quantity_withdrawn;
    });
    return Object.values(map);
  }, [monthCustody]);

  // Initialize settle items when month changes
  React.useEffect(() => {
    setSettleItems(custodyByItem.map(c => ({
      ...c, actual_qty_used: c.withdrawn_qty,
      total_cost: c.withdrawn_qty * c.cost_price,
    })));
  }, [selectedMonth, allCustody.length]);

  const updateActualQty = (idx, val) => {
    setSettleItems(prev => prev.map((si, i) => i === idx
      ? { ...si, actual_qty_used: parseFloat(val) || 0, total_cost: (parseFloat(val) || 0) * si.cost_price }
      : si
    ));
  };

  const totalWorkshopCost = settleItems.reduce((s, si) => s + (si.total_cost || 0), 0);

  const monthSales = salesInvoices.filter(inv => inv.month_key === selectedMonth);
  const totalSalesRevenue = monthSales.reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const totalSalesCost = monthSales.reduce((s, inv) => s + (inv.cost_total || 0), 0);
  const grossProfit = totalSalesRevenue - totalSalesCost;
  const netProfit = grossProfit - totalWorkshopCost;

  const existingSettlement = settlements.find(s => s.month_key === selectedMonth && s.status === 'approved');

  // Journal Entry auto-generation
  const generateJournal = (data) => {
    const lines = [
      `قيد محاسبي — تسوية مصروفات الورشة`,
      `الشهر: ${monthLabel(selectedMonth)}`,
      `─────────────────────────────────`,
      `مدين: حساب مصروفات الورشة   ${data.totalWorkshopCost.toFixed(2)} ر.س`,
      `دائن: حساب مخزون الورشة      ${data.totalWorkshopCost.toFixed(2)} ر.س`,
      `─────────────────────────────────`,
      `إجمالي مبيعات الشهر:   ${data.totalSalesRevenue.toFixed(2)} ر.س`,
      `تكلفة البضاعة المباعة: ${data.totalSalesCost.toFixed(2)} ر.س`,
      `إجمالي ربح المبيعات:   ${data.grossProfit.toFixed(2)} ر.س`,
      `(-) تكاليف الورشة:    ${data.totalWorkshopCost.toFixed(2)} ر.س`,
      `= صافي الربح الحقيقي:  ${data.netProfit.toFixed(2)} ر.س`,
      `─────────────────────────────────`,
      `اعتمد بواسطة: ${session?.name || 'المدير'}`,
      `تاريخ الاعتماد: ${format(new Date(), 'yyyy/MM/dd HH:mm')}`,
    ].join('\n');
    return lines;
  };

  const approve = useMutation({
    mutationFn: async () => {
      if (settleItems.length === 0) throw new Error('لا توجد مسحوبات لتسويتها');
      const journalEntry = generateJournal({ totalWorkshopCost, totalSalesRevenue, totalSalesCost, grossProfit, netProfit });

      const settlement = await base44.entities.WorkshopSettlement.create({
        month_key: selectedMonth,
        month_label: monthLabel(selectedMonth),
        settlement_items: settleItems,
        total_workshop_cost: totalWorkshopCost,
        total_sales_revenue: totalSalesRevenue,
        total_sales_cost: totalSalesCost,
        gross_profit: grossProfit,
        net_profit: netProfit,
        status: 'approved',
        approved_by: session?.name,
        approved_at: new Date().toISOString(),
        journal_entry: journalEntry,
        notes,
      });

      // Mark custody records as settled
      for (const c of monthCustody) {
        await base44.entities.WorkshopCustody.update(c.id, { settled: true, settlement_id: settlement.id });
      }

      // Record deduction movement
      for (const si of settleItems) {
        if (!si.actual_qty_used) continue;
        await base44.entities.StockMovement.create({
          item_id: si.item_id, item_name: si.item_name,
          movement_type: 'settlement_deduction',
          quantity: si.actual_qty_used, unit: si.unit,
          from_location: 'workshop', to_location: 'consumed',
          cost_price: si.cost_price,
          reference_id: settlement.id, reference_type: 'settlement',
          created_by_name: session?.name,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-custody-all'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-settlements'] });
      toast.success('تمت التسوية واعتماد القيد المحاسبي ✅');
    },
    onError: (e) => toast.error(e.message),
  });

  // Month options (last 12 months)
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = format(d, 'yyyy-MM');
    monthOptions.push({ key, label: monthLabel(key) });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {existingSettlement && (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 ml-1" /> تمت التسوية
          </Badge>
        )}
      </div>

      {existingSettlement ? (
        // Show approved settlement
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              تسوية معتمدة — {existingSettlement.month_label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'إجمالي المبيعات', val: existingSettlement.total_sales_revenue, color: 'text-blue-600' },
                { label: 'تكلفة الورشة', val: existingSettlement.total_workshop_cost, color: 'text-red-600' },
                { label: 'إجمالي ربح المبيعات', val: existingSettlement.gross_profit, color: 'text-green-600' },
                { label: 'صافي الربح الحقيقي', val: existingSettlement.net_profit, color: 'text-primary font-black' },
              ].map((s, i) => (
                <div key={i} className="rounded-xl bg-muted/40 p-3 text-center">
                  <p className={`text-xl font-black ${s.color}`}>{s.val?.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label} ر.س</p>
                </div>
              ))}
            </div>
            <pre className="text-xs bg-muted/50 rounded-xl p-4 whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">
              {existingSettlement.journal_entry}
            </pre>
          </CardContent>
        </Card>
      ) : (
        // Settlement form
        <>
          {/* Summary preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'إجمالي مبيعات الشهر', val: totalSalesRevenue.toFixed(2), sub: 'ر.س', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'تكاليف الورشة (مقدّر)', val: totalWorkshopCost.toFixed(2), sub: 'ر.س', color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'إجمالي ربح المبيعات', val: grossProfit.toFixed(2), sub: 'ر.س', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'صافي الربح الحقيقي', val: netProfit.toFixed(2), sub: 'ر.س', color: netProfit >= 0 ? 'text-primary' : 'text-red-600', bg: 'bg-primary/5' },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label} ({s.sub})</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                تفاصيل التسوية — أدخل الكميات الفعلية المستهلكة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {settleItems.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>لا توجد مسحوبات غير مسوّاة لهذا الشهر</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-right py-2 px-3">المادة</th>
                          <th className="text-center py-2 px-3">المسحوب</th>
                          <th className="text-center py-2 px-3">المستهلك الفعلي</th>
                          <th className="text-right py-2 px-3">التكلفة</th>
                          <th className="text-right py-2 px-3">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settleItems.map((si, idx) => (
                          <tr key={si.item_id} className="border-b">
                            <td className="py-2 px-3 font-medium">{si.item_name} <span className="text-xs text-muted-foreground">({UNITS[si.unit] || si.unit})</span></td>
                            <td className="py-2 px-3 text-center text-muted-foreground">{si.withdrawn_qty}</td>
                            <td className="py-2 px-3">
                              <Input
                                type="number" min={0} step={0.1}
                                value={si.actual_qty_used}
                                onChange={e => updateActualQty(idx, e.target.value)}
                                className="w-24 h-7 text-sm text-center mx-auto"
                              />
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{si.cost_price} ر.س</td>
                            <td className="py-2 px-3 font-bold text-red-600">{si.total_cost.toFixed(2)} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1">
                    <Label>ملاحظات (اختياري)</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات على التسوية..." />
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm">
                    <p className="font-bold text-amber-800 mb-1">⚠️ تنبيه مهم</p>
                    <p className="text-amber-700">بالضغط على "اعتماد التسوية" سيتم إنشاء قيد محاسبي تلقائي وخصم تكاليف الورشة من أرباح المبيعات. هذا الإجراء لا يمكن التراجع عنه.</p>
                  </div>

                  <Button className="w-full gap-2" disabled={approve.isPending} onClick={() => approve.mutate()}>
                    <ShieldCheck className="w-4 h-4" />
                    {approve.isPending ? 'جاري الاعتماد...' : 'اعتماد التسوية وإنشاء القيد المحاسبي ✅'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">سجل التسويات السابقة</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {settlements.filter(s => s.status === 'approved').map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{s.month_label}</p>
                  <p className="text-xs text-muted-foreground">اعتمد بواسطة: {s.approved_by}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-primary">{s.net_profit?.toFixed(0)} ر.س</p>
                  <p className="text-xs text-muted-foreground">صافي الربح</p>
                </div>
              </div>
            ))}
            {settlements.filter(s => s.status === 'approved').length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">لا توجد تسويات سابقة</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Workshop Stock Tab (Admin only) ──────────────────────────────────────────
function WorkshopStockTab({ items, session }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ item_id: '', qty: '' });
  const workshopItems = items.filter(i => i.category === 'workshop' || i.category === 'both');

  const addStock = useMutation({
    mutationFn: async () => {
      const item = workshopItems.find(i => i.id === form.item_id);
      if (!item) throw new Error('اختر مادة');
      const qty = parseFloat(form.qty);
      await base44.entities.InventoryItem.update(form.item_id, {
        workshop_qty: (item.workshop_qty || 0) + qty,
      });
      await base44.entities.StockMovement.create({
        item_id: item.id, item_name: item.name, movement_type: 'workshop_in',
        quantity: qty, unit: item.unit,
        from_location: 'purchase', to_location: 'workshop',
        cost_price: item.cost_price, reference_type: 'manual',
        created_by_name: session?.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('تم إضافة المواد لمخزن الورشة ✅');
      setForm({ item_id: '', qty: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            إضافة مواد لمخزن الورشة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="space-y-1 flex-1">
              <Label>المادة</Label>
              <Select value={form.item_id} onValueChange={v => setForm(p => ({...p, item_id: v}))}>
                <SelectTrigger><SelectValue placeholder="اختر مادة" /></SelectTrigger>
                <SelectContent>
                  {workshopItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-28">
              <Label>الكمية</Label>
              <Input type="number" min={0.1} step={0.1} value={form.qty} onChange={e => setForm(p => ({...p, qty: e.target.value}))} />
            </div>
            <Button disabled={!form.item_id || !form.qty || addStock.isPending} onClick={() => addStock.mutate()}>
              {addStock.isPending ? 'جاري...' : 'إضافة'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-right py-2 px-3">المادة</th>
              <th className="text-center py-2 px-3">رصيد الورشة</th>
              <th className="text-right py-2 px-3">التكلفة</th>
              <th className="text-right py-2 px-3">القيمة الإجمالية</th>
            </tr>
          </thead>
          <tbody>
            {workshopItems.map(item => (
              <tr key={item.id} className="border-b hover:bg-muted/20">
                <td className="py-2.5 px-3 font-medium">{item.name}</td>
                <td className="py-2.5 px-3 text-center font-bold">
                  {item.workshop_qty || 0} {UNITS[item.unit] || item.unit}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">{item.cost_price} ر.س</td>
                <td className="py-2.5 px-3 font-medium">{((item.workshop_qty || 0) * item.cost_price).toFixed(2)} ر.س</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WorkshopSystem() {
  const session = getSession();

  const { data: items } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => base44.entities.InventoryItem.list('-created_at', 200),
    initialData: [],
  });

  const isAdmin = session?.role === 'admin';

  const { data: allCustodyStats } = useQuery({
    queryKey: ['workshop-custody-all'],
    queryFn: () => base44.entities.WorkshopCustody.list('-created_at', 500),
    initialData: [],
  });

  const workshopItems = items.filter(i => i.category === 'workshop' || i.category === 'both');
  const totalWorkshopStock = workshopItems.reduce((s, i) => s + (i.workshop_qty || 0) * (i.cost_price || 0), 0);
  const thisMonthWithdrawals = allCustodyStats.filter(c => c.month_key === format(new Date(), 'yyyy-MM'));
  const monthWithdrawalCost = thisMonthWithdrawals.reduce((s, c) => s + (c.total_cost || 0), 0);

  return (
    <div dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">نظام العهدة والورشة</h1>
          <p className="text-sm text-muted-foreground">مستقل تماماً عن نظام المبيعات — مسحوبات الفنيين · التسوية الشهرية</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'قيمة مخزن الورشة', value: totalWorkshopStock.toFixed(0) + ' ر.س', icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'تكاليف هذا الشهر', value: monthWithdrawalCost.toFixed(0) + ' ر.س', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'إجمالي المسحوبات', value: thisMonthWithdrawals.length, icon: ClipboardList, color: 'text-primary', bg: 'bg-primary/5' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-xl font-black">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="withdrawal">
        <TabsList className="mb-4">
          <TabsTrigger value="withdrawal">تسجيل المسحوبات</TabsTrigger>
          {isAdmin && <TabsTrigger value="workshop-stock">مخزن الورشة</TabsTrigger>}
          {isAdmin && <TabsTrigger value="settlement">التسوية الشهرية 📊</TabsTrigger>}
        </TabsList>
        <TabsContent value="withdrawal">
          <WithdrawalTab items={items} session={session} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="workshop-stock">
            <WorkshopStockTab items={items} session={session} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="settlement">
            <SettlementTab items={items} session={session} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}