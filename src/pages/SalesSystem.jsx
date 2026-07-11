import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useZATCA } from '@/lib/zatca/useZATCA';
import {
  ShoppingCart, Package, ArrowRightLeft, Plus, Minus, Trash2,
  FileText, Warehouse, Building2, TrendingUp, Search, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import ReceiptView from '@/components/pos/ReceiptView';
import { salesInvoiceToReceipt } from '@/lib/invoiceAdapter';

const UNITS = { piece: 'حبة', dozen: 'درزن', carton: 'كرتون', kg: 'كغ', liter: 'لتر' };

function genInvoiceNo() {
  return 'INV-' + Date.now().toString().slice(-8);
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────
function InventoryTab({ items, branches, session }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', sku: '', unit: 'piece', cost_price: '', sell_price: '', category: 'sales', warehouse_qty: '' });
  const [transfer, setTransfer] = useState({ qty: '', to_branch: '' });

  const addItem = useMutation({
    mutationFn: (data) => base44.entities.InventoryItem.create(data),
    onSuccess: async (item) => {
      // Record movement
      await base44.entities.StockMovement.create({
        item_id: item.id, item_name: item.name, movement_type: 'warehouse_in',
        quantity: item.warehouse_qty || 0, unit: item.unit,
        from_location: 'external', to_location: 'warehouse',
        cost_price: item.cost_price, reference_type: 'manual',
        created_by_name: session?.name,
      });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('تمت إضافة المنتج');
      setAddOpen(false);
      setForm({ name: '', sku: '', unit: 'piece', cost_price: '', sell_price: '', category: 'sales', warehouse_qty: '' });
    },
  });

  const doTransfer = useMutation({
    mutationFn: async ({ item, qty, toBranch, branchName }) => {
      const newWarehouse = (item.warehouse_qty || 0) - qty;
      if (newWarehouse < 0) throw new Error('الكمية في المستودع غير كافية');
      const branchQty = item.branch_qty || {};
      branchQty[toBranch] = (branchQty[toBranch] || 0) + qty;
      await base44.entities.InventoryItem.update(item.id, { warehouse_qty: newWarehouse, branch_qty: branchQty });
      await base44.entities.StockMovement.create({
        item_id: item.id, item_name: item.name, movement_type: 'warehouse_to_branch',
        quantity: qty, unit: item.unit, from_location: 'warehouse', to_location: toBranch,
        cost_price: item.cost_price, reference_type: 'transfer',
        branch_id: toBranch, branch_name: branchName, created_by_name: session?.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('تم التحويل من المستودع للفرع ✅');
      setTransferOpen(false);
      setTransfer({ qty: '', to_branch: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = items.filter(i => i.category !== 'workshop' &&
    (!search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.sku?.includes(search)));

  const salesBranches = branches.filter(b => b.is_active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الرمز..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> إضافة منتج
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-right py-2 px-3 font-medium">المنتج</th>
              <th className="text-right py-2 px-3 font-medium">الوحدة</th>
              <th className="text-center py-2 px-3 font-medium">المستودع</th>
              {salesBranches.map(b => (
                <th key={b.id} className="text-center py-2 px-3 font-medium">{b.name}</th>
              ))}
              <th className="text-right py-2 px-3 font-medium">التكلفة</th>
              <th className="text-right py-2 px-3 font-medium">البيع</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const lowStock = (item.warehouse_qty || 0) <= (item.min_stock || 0);
              return (
                <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{UNITS[item.unit] || item.unit}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`font-bold ${lowStock ? 'text-red-600' : 'text-foreground'}`}>
                      {item.warehouse_qty || 0}
                    </span>
                    {lowStock && <AlertCircle className="w-3 h-3 text-red-500 inline mr-1" />}
                  </td>
                  {salesBranches.map(b => (
                    <td key={b.id} className="py-2.5 px-3 text-center font-medium">
                      {(item.branch_qty || {})[b.id] || 0}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-muted-foreground">{item.cost_price} ر.س</td>
                  <td className="py-2.5 px-3 font-medium">{item.sell_price || '-'} ر.س</td>
                  <td className="py-2.5 px-3">
                    <Button size="sm" variant="outline" className="text-xs gap-1"
                      onClick={() => { setTransferItem(item); setTransferOpen(true); }}>
                      <ArrowRightLeft className="w-3 h-3" /> تحويل
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>لا توجد منتجات بعد</p>
          </div>
        )}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>إضافة منتج جديد</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>اسم المنتج *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>رمز SKU</Label>
                <Input value={form.sku} onChange={e => setForm(p => ({...p, sku: e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الوحدة</Label>
                <Select value={form.unit} onValueChange={v => setForm(p => ({...p, unit: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNITS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">مبيعات فقط</SelectItem>
                    <SelectItem value="workshop">ورشة فقط</SelectItem>
                    <SelectItem value="both">كلاهما</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>سعر التكلفة *</Label>
                <Input type="number" value={form.cost_price} onChange={e => setForm(p => ({...p, cost_price: e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>سعر البيع</Label>
                <Input type="number" value={form.sell_price} onChange={e => setForm(p => ({...p, sell_price: e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>كمية المستودع</Label>
                <Input type="number" value={form.warehouse_qty} onChange={e => setForm(p => ({...p, warehouse_qty: e.target.value}))} />
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button disabled={!form.name || !form.cost_price || addItem.isPending}
              onClick={() => addItem.mutate({
                name: form.name, sku: form.sku, unit: form.unit,
                cost_price: parseFloat(form.cost_price),
                sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
                category: form.category,
                warehouse_qty: parseInt(form.warehouse_qty) || 0,
              })}>
              {addItem.isPending ? 'جاري...' : 'إضافة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>تحويل من المستودع إلى فرع</DialogTitle></DialogHeader>
          {transferItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-muted/40 p-3 text-sm">
                <p className="font-bold">{transferItem.name}</p>
                <p className="text-muted-foreground">متوفر في المستودع: <strong className="text-foreground">{transferItem.warehouse_qty || 0}</strong> {UNITS[transferItem.unit]}</p>
              </div>
              <div className="space-y-1">
                <Label>الفرع المستهدف</Label>
                <Select value={transfer.to_branch} onValueChange={v => setTransfer(p => ({...p, to_branch: v}))}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {salesBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الكمية</Label>
                <Input type="number" min={1} value={transfer.qty} onChange={e => setTransfer(p => ({...p, qty: e.target.value}))} />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setTransferOpen(false)}>إلغاء</Button>
                <Button disabled={!transfer.to_branch || !transfer.qty || doTransfer.isPending}
                  onClick={() => {
                    const b = salesBranches.find(x => x.id === transfer.to_branch);
                    doTransfer.mutate({ item: transferItem, qty: parseInt(transfer.qty), toBranch: transfer.to_branch, branchName: b?.name });
                  }}>
                  {doTransfer.isPending ? 'جاري...' : 'تحويل ✅'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Invoice Tab ──────────────────────────────────────────────────────────────
function InvoiceTab({ items, branches, session }) {
  const queryClient = useQueryClient();
  const { submitInvoice } = useZATCA();
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [selectedBranch, setSelectedBranch] = useState(session?.branch_id || '');
  const [payMethod, setPayMethod] = useState('cash');
  const [search, setSearch] = useState('');
  const [printInvoice, setPrintInvoice] = useState(null);

  const branchItems = useMemo(() => {
    if (!selectedBranch) return [];
    return items.filter(i => i.category !== 'workshop' &&
      ((i.branch_qty || {})[selectedBranch] || 0) > 0 &&
      (!search || i.name?.toLowerCase().includes(search.toLowerCase())));
  }, [items, selectedBranch, search]);

  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(c => c.item_id === item.id);
      if (ex) return prev.map(c => c.item_id === item.id ? {...c, qty: c.qty + 1} : c);
      return [...prev, { item_id: item.id, item_name: item.name, unit: item.unit, sell_price: item.sell_price || 0, cost_price: item.cost_price || 0, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c.item_id === id ? {...c, qty: Math.max(1, c.qty + delta)} : c).filter(c => c.qty > 0));
  };

  const subtotal = cart.reduce((s, c) => s + c.sell_price * c.qty, 0);
  const vatAmt = subtotal * 0.15;
  const total = subtotal + vatAmt;
  const costTotal = cart.reduce((s, c) => s + c.cost_price * c.qty, 0);
  const grossProfit = subtotal - costTotal;

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!selectedBranch) throw new Error('اختر الفرع أولاً');
      if (cart.length === 0) throw new Error('الفاتورة فارغة');
      const branch = branches.find(b => b.id === selectedBranch);
      const monthKey = format(new Date(), 'yyyy-MM');

      const invoice = await base44.entities.SalesInvoice.create({
        invoice_number: genInvoiceNo(),
        customer_name: customer.name || 'عميل نقدي',
        customer_phone: customer.phone,
        branch_id: selectedBranch,
        branch_name: branch?.name || '',
        items: cart,
        subtotal, vat_amount: vatAmt, total,
        cost_total: costTotal, gross_profit: grossProfit,
        payment_method: payMethod, payment_status: 'paid',
        month_key: monthKey,
        employee_name: session?.name || '',
      });

      // Deduct from branch stock + record movements
      for (const line of cart) {
        const inv = items.find(i => i.id === line.item_id);
        if (!inv) continue;
        const bqty = inv.branch_qty || {};
        bqty[selectedBranch] = Math.max(0, (bqty[selectedBranch] || 0) - line.qty);
        await base44.entities.InventoryItem.update(inv.id, { branch_qty: bqty });
        await base44.entities.StockMovement.create({
          item_id: inv.id, item_name: inv.name, movement_type: 'branch_sale',
          quantity: line.qty, unit: inv.unit,
          from_location: selectedBranch, to_location: 'customer',
          cost_price: inv.cost_price, sell_price: inv.sell_price,
          reference_id: invoice.id, reference_type: 'invoice',
          branch_id: selectedBranch, branch_name: branch?.name,
          created_by_name: session?.name,
        });
      }
      // ── ZATCA Phase 2 — الإرسال الرسمي الحقيقي (خادم آمن) ──
      const zatcaResult = await submitInvoice('sale', invoice.id);
      return { ...invoice, _zatca: zatcaResult };
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast.success('تم إصدار الفاتورة وخصم المخزون ✅');
      setCart([]);
      setCustomer({ name: '', phone: '' });
      setPrintInvoice({
        ...invoice,
        zatca_qr: invoice._zatca?.qr || invoice.zatca_qr,
        zatca_status: invoice._zatca?.zatcaStatus || invoice.zatca_status,
      }); // يفتح نافذة الفاتورة ويطبعها فوراً — بالـ QR الرسمي من زاتكا
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: invoices } = useQuery({
    queryKey: ['sales-invoices'],
    queryFn: () => base44.entities.SalesInvoice.list('-created_at', 20),
    initialData: [],
  });

  const salesBranches = branches.filter(b => b.is_active);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Products */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-44"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
            <SelectContent>
              {salesBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في المنتجات..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
        </div>

        {!selectedBranch ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>اختر الفرع لعرض المنتجات المتاحة</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {branchItems.map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="rounded-xl border p-3 text-right hover:border-primary hover:bg-primary/5 transition-all">
                <p className="font-medium text-sm mb-1 line-clamp-1">{item.name}</p>
                <p className="text-xs text-muted-foreground">متوفر: {(item.branch_qty || {})[selectedBranch] || 0} {UNITS[item.unit]}</p>
                <p className="text-sm font-bold text-primary mt-1">{item.sell_price} ر.س</p>
              </button>
            ))}
            {branchItems.length === 0 && (
              <div className="col-span-3 text-center py-10 text-muted-foreground text-sm">
                لا توجد منتجات في هذا الفرع
              </div>
            )}
          </div>
        )}

        {/* Recent invoices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              آخر الفواتير
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {invoices.slice(0, 8).map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.customer_name} · {inv.branch_name}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{inv.total?.toFixed(0)} ر.س</p>
                    <Badge variant="outline" className="text-[10px]">{inv.payment_method === 'cash' ? 'نقد' : 'شبكة'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cart */}
      <div>
        <Card className="sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              الفاتورة الحالية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="اسم العميل" value={customer.name} onChange={e => setCustomer(p => ({...p, name: e.target.value}))} className="text-sm" />
              <Input placeholder="رقم الهاتف" value={customer.phone} onChange={e => setCustomer(p => ({...p, phone: e.target.value}))} className="text-sm" />
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
                اضغط على منتج لإضافته
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(line => (
                  <div key={line.item_id} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{line.item_name}</p>
                      <p className="text-xs text-muted-foreground">{line.sell_price} ر.س × {line.qty}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(line.item_id, -1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold">{line.qty}</span>
                      <button onClick={() => updateQty(line.item_id, 1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => setCart(prev => prev.filter(c => c.item_id !== line.item_id))} className="w-6 h-6 rounded-md text-destructive flex items-center justify-center hover:bg-destructive/10">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>المجموع قبل الضريبة</span><span>{subtotal.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ضريبة 15%</span><span>{vatAmt.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>الإجمالي</span><span className="text-primary">{total.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-xs text-green-600">
                <span>إجمالي الربح</span><span>{grossProfit.toFixed(2)} ر.س</span>
              </div>
            </div>

            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقداً</SelectItem>
                <SelectItem value="network">شبكة</SelectItem>
                <SelectItem value="credit">آجل</SelectItem>
              </SelectContent>
            </Select>

            <Button className="w-full" disabled={cart.length === 0 || createInvoice.isPending} onClick={() => createInvoice.mutate()}>
              {createInvoice.isPending ? 'جاري الإصدار...' : 'إصدار الفاتورة ✅'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* نافذة الفاتورة — تُفتح وتُطبع تلقائياً فور إصدار فاتورة منتج جديدة */}
      <Dialog open={!!printInvoice} onOpenChange={(open) => !open && setPrintInvoice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>الفاتورة #{printInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {printInvoice && (
            <ReceiptView order={salesInvoiceToReceipt(printInvoice)} autoPrint />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Transfer Report Tab ──────────────────────────────────────────────────────
function TransferReportTab({ movements, branches }) {
  const transfers = movements.filter(m => m.movement_type === 'warehouse_to_branch');
  const byItem = {};
  transfers.forEach(m => {
    if (!byItem[m.item_name]) byItem[m.item_name] = { item_name: m.item_name, movements: [] };
    byItem[m.item_name].movements.push(m);
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm">
        <p className="font-bold text-amber-800 mb-1">📊 تقرير التحويل من المستودع إلى الفروع</p>
        <p className="text-amber-700">يُظهر هذا التقرير كل بضاعة خرجت من المستودع ووجهتها. أي بضاعة خرجت يجب أن تظهر في رصيد الفرع.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-right py-2 px-3">المنتج</th>
              <th className="text-right py-2 px-3">الفرع</th>
              <th className="text-center py-2 px-3">الكمية</th>
              <th className="text-right py-2 px-3">التكلفة</th>
              <th className="text-right py-2 px-3">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map(m => (
              <tr key={m.id} className="border-b hover:bg-muted/20">
                <td className="py-2 px-3 font-medium">{m.item_name}</td>
                <td className="py-2 px-3 text-muted-foreground">{m.branch_name || m.to_location}</td>
                <td className="py-2 px-3 text-center">{m.quantity} {UNITS[m.unit] || m.unit}</td>
                <td className="py-2 px-3">{((m.cost_price || 0) * m.quantity).toFixed(2)} ر.س</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">{m.created_at ? format(new Date(m.created_at), 'yyyy/MM/dd') : '-'}</td>
              </tr>
            ))}
            {transfers.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">لا توجد تحويلات بعد</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SalesSystem() {
  const session = getSession();

  const { data: items } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => base44.entities.InventoryItem.list('-created_at', 200),
    initialData: [],
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    initialData: [],
  });

  const { data: movements } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: () => base44.entities.StockMovement.list('-created_at', 300),
    initialData: [],
  });

  if (!session) return <Navigate to="/login" replace />;

  const isAdmin = ['admin','owner','manager'].includes(session?.role);

  // Summary
  const salesItems = items.filter(i => i.category !== 'workshop');
  const totalWarehouse = salesItems.reduce((s, i) => s + (i.warehouse_qty || 0), 0);
  const warehouseValue = salesItems.reduce((s, i) => s + (i.warehouse_qty || 0) * (i.cost_price || 0), 0);

  return (
    <div dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">نظام المبيعات والمخازن</h1>
          <p className="text-sm text-muted-foreground">مستقل تماماً عن نظام الورشة — فواتير · مخزون · تحويلات</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'منتجات المبيعات', value: salesItems.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'إجمالي المستودع', value: totalWarehouse + ' وحدة', icon: Warehouse, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'قيمة المخزون', value: warehouseValue.toFixed(0) + ' ر.س', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'حركات اليوم', value: movements.filter(m => m.created_at && format(new Date(m.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length, icon: ArrowRightLeft, color: 'text-primary', bg: 'bg-primary/5' },
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

      <Tabs defaultValue={isAdmin ? 'inventory' : 'invoice'}>
        <TabsList className="mb-4">
          {isAdmin && <TabsTrigger value="inventory">المخزون والمنتجات</TabsTrigger>}
          <TabsTrigger value="invoice">إصدار الفواتير</TabsTrigger>
          {isAdmin && <TabsTrigger value="transfers">تقرير التحويلات</TabsTrigger>}
        </TabsList>
        {isAdmin && (
          <TabsContent value="inventory">
            <InventoryTab items={items} branches={branches} session={session} />
          </TabsContent>
        )}
        <TabsContent value="invoice">
          <InvoiceTab items={items} branches={branches} session={session} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="transfers">
            <TransferReportTab movements={movements} branches={branches} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}