import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Search, Wrench, ShoppingBag, Eye } from 'lucide-react';
import { format } from 'date-fns';
import ReceiptView from '@/components/pos/ReceiptView';
import { salesInvoiceToReceipt } from '@/lib/invoiceAdapter';

const PAYMENT_LABELS = { cash: 'نقداً', network: 'شبكة', credit: 'آجل' };

const TYPE_TABS = [
  { key: 'all',     label: 'الكل',             icon: FileText },
  { key: 'repair',  label: 'إصلاح 🔧',           icon: Wrench },
  { key: 'product', label: 'بيع منتج 🛍️',        icon: ShoppingBag },
];

export default function Invoices() {
  const [activeType, setActiveType] = useState('all');
  const [search, setSearch] = useState('');
  const [viewInvoice, setViewInvoice] = useState(null); // { kind, raw }

  const { data: orders = [] } = useQuery({
    queryKey: ['invoices-orders'],
    queryFn: () => db.Order.list('-created_at', 300),
  });

  const { data: salesInvoices = [] } = useQuery({
    queryKey: ['invoices-sales'],
    queryFn: () => db.SalesInvoice.list('-created_at', 300),
  });

  const merged = useMemo(() => {
    const repairRows = orders.map(o => ({
      id: `order-${o.id}`,
      kind: 'repair',
      number: o.order_number,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      total: o.total_price,
      payment_method: o.payment_method,
      payment_status: o.payment_status || (o.status === 'completed' ? 'paid' : 'pending'),
      created_at: o.created_at,
      raw: o,
    }));
    const productRows = salesInvoices.map(inv => ({
      id: `sale-${inv.id}`,
      kind: 'product',
      number: inv.invoice_number,
      customer_name: inv.customer_name,
      customer_phone: inv.customer_phone,
      total: inv.total,
      payment_method: inv.payment_method,
      payment_status: inv.payment_status || 'paid',
      created_at: inv.created_at,
      raw: inv,
    }));
    return [...repairRows, ...productRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [orders, salesInvoices]);

  const filtered = merged.filter(row => {
    const typeOk = activeType === 'all' || row.kind === activeType;
    const s = search.trim().toLowerCase();
    const searchOk = !s
      || row.number?.toLowerCase().includes(s)
      || row.customer_name?.toLowerCase().includes(s)
      || row.customer_phone?.includes(s);
    return typeOk && searchOk;
  });

  const totals = {
    all: merged.length,
    repair: merged.filter(r => r.kind === 'repair').length,
    product: merged.filter(r => r.kind === 'product').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            الفواتير
          </h1>
          <p className="text-sm text-muted-foreground mt-1">كل فواتير الإصلاح ومبيعات المنتجات في مكان واحد</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveType(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all border
              ${activeType === tab.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className="opacity-70">({totals[tab.key]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث برقم الفاتورة أو اسم العميل أو الجوال..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>لا توجد فواتير مطابقة</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(row => (
                <div key={row.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                      ${row.kind === 'repair' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'}`}>
                      {row.kind === 'repair' ? <Wrench className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{row.number}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.customer_name || 'عميل نقدي'} {row.customer_phone && `· ${row.customer_phone}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
                      {row.kind === 'repair' ? 'إصلاح' : 'منتج'}
                    </Badge>
                    <div className="text-left hidden sm:block">
                      <p className="text-xs text-muted-foreground">{row.created_at && format(new Date(row.created_at), 'dd/MM/yyyy HH:mm')}</p>
                      <Badge variant="outline" className="text-[10px]">{PAYMENT_LABELS[row.payment_method] || row.payment_method || '—'}</Badge>
                    </div>
                    <p className="font-black text-primary w-20 text-left">{row.total?.toFixed(0)} ر.س</p>

                    {row.kind === 'repair' ? (
                      <Link to={`/orders/${row.raw.id}`}>
                        <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="عرض الطلب والفاتورة">
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>
                    ) : (
                      <button onClick={() => setViewInvoice(row)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="عرض وطباعة الفاتورة">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة عرض/طباعة فاتورة منتج (لا توجد لها صفحة تفاصيل مستقلة) */}
      <Dialog open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>الفاتورة #{viewInvoice?.number}</DialogTitle>
          </DialogHeader>
          {viewInvoice && <ReceiptView order={salesInvoiceToReceipt(viewInvoice.raw)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
