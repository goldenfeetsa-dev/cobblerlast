import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListOrdered, Search, Clock, Package, CheckCircle2, XCircle, Loader2, Barcode, Layers, Truck } from 'lucide-react';
import { getSession } from '@/lib/sessionStore';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useLoyalty } from '@/lib/loyalty/useLoyalty';

const STATUS_CONFIG = {
  pending: { label: 'قيد الانتظار', icon: Clock, class: 'bg-amber-100 text-amber-700 border-amber-200' },
  in_progress: { label: 'جارٍ التنفيذ', icon: Loader2, class: 'bg-blue-100 text-blue-700 border-blue-200' },
  ready: { label: 'جاهز', icon: Package, class: 'bg-green-100 text-green-700 border-green-200' },
  completed: { label: 'مكتمل', icon: CheckCircle2, class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'ملغى', icon: XCircle, class: 'bg-red-100 text-red-700 border-red-200' },
  returned: { label: 'مُسترجع', icon: XCircle, class: 'bg-orange-100 text-orange-700 border-orange-200' },
  exchanged: { label: 'مُستبدَل', icon: CheckCircle2, class: 'bg-purple-100 text-purple-700 border-purple-200' },
  on_hold: { label: 'متوقف', icon: Clock, class: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
};

const ITEM_LABELS = {
  shoes: 'أحذية', bag: 'حقيبة', dress: 'فستان', suit: 'بدلة',
  jacket: 'جاكيت', pants: 'بنطال', shirt: 'قميص', other: 'أخرى'
};

export default function Orders() {
  const session = getSession();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shelfInputs, setShelfInputs] = useState({}); // orderId -> shelf text
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { addStamp } = useLoyalty();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] }); // ينطبق على كل مفاتيح orders.* (list/dashboard/operations)
      // إضافة ختمة تلقائياً عند إتمام الطلب
      if (variables.data?.status === 'completed') {
        const order = orders?.find(o => o.id === variables.id);
        if (order?.customer_phone) {
          try {
            await addStamp({
              phone: order.customer_phone,
              name: order.customer_name || 'عميل',
              orderId: order.id,
              orderNumber: order.order_number,
              serviceType: order.item_type,
              amount: order.total_price || 0,
            });
          } catch {
            // الختمة اختيارية — لا نوقف العملية
          }
        }
      }
    },
    onError: (e) => toast.error(`فشل التحديث: ${e.message}`),
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', 'list'],
    queryFn: () => base44.entities.Order.list('-created_at', 200,
      'id, order_number, customer_name, customer_phone, employee_name, item_type, quantity, shelf_location, status, payment_status, payment_method, total_price, photos, created_at, branch_id, delivery_method'),
    initialData: [],
  });

  const filtered = orders.filter(o => {
    // Branch filter: staff sees only their branch, admin sees all
    if (!['admin','owner','manager'].includes(session?.role) && session?.branch_id) {
      if (o.branch_id && o.branch_id !== session.branch_id) return false;
    }
    const matchSearch = !search || 
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone?.includes(search);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ListOrdered className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-sm text-muted-foreground">{orders.length} طلب إجمالاً</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث برقم الطلب أو الاسم أو الهاتف..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="in_progress">جارٍ التنفيذ</SelectItem>
            <SelectItem value="ready">جاهز</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغى</SelectItem>
            <SelectItem value="returned">مُسترجع</SelectItem>
            <SelectItem value="exchanged">مُستبدَل</SelectItem>
            <SelectItem value="on_hold">متوقف</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ListOrdered className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد طلبات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            return (
              <Card key={order.id} className="p-4 hover:shadow-md transition-all hover:border-primary/20">
                <div className="flex items-center justify-between">
                  <Link to={`/orders/${order.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    {order.photos?.[0] ? (
                      <img src={order.photos[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm font-mono">{order.order_number}</span>
                        <Badge variant="outline" className={`text-[10px] ${status.class}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {order.customer_name} • {ITEM_LABELS[order.item_type] || order.item_type} × {order.quantity || 1}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.created_at ? format(new Date(order.created_at), 'yyyy/MM/dd HH:mm:ss') : '—'} • {order.employee_name}
                      </p>
                    </div>
                  </Link>
                  <div className="text-left flex flex-col items-end gap-1 shrink-0 mr-2">
                    <p className="font-bold text-lg">{order.total_price?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">ر.س</p>
                    <Badge variant="outline" className={`text-[10px] ${order.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {order.payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[10px] h-6 px-2"
                      onClick={e => { e.preventDefault(); navigate(`/barcode/${order.id}`); }}
                    >
                      <Barcode className="w-3 h-3 ml-1" />
                      باركود
                    </Button>
                  </div>
                </div>

                {/* Shelf + Delivery row — shown only when status is ready or completed (with shelf) */}
                {(order.status === 'ready' || (order.status === 'completed' && order.shelf_location)) && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2" dir="rtl">
                    {order.status === 'ready' && !order.shelf_location && (
                      <>
                        <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                        <Input
                          placeholder="رقم الرف / مكان التخزين"
                          value={shelfInputs[order.id] || ''}
                          onChange={e => setShelfInputs(p => ({ ...p, [order.id]: e.target.value }))}
                          className="h-8 text-sm max-w-[200px]"
                          onClick={e => e.preventDefault()}
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                          disabled={!shelfInputs[order.id]?.trim() || updateMutation.isPending}
                          onClick={e => {
                            e.preventDefault();
                            updateMutation.mutate({ id: order.id, data: { shelf_location: shelfInputs[order.id].trim() } });
                            setShelfInputs(p => ({ ...p, [order.id]: '' }));
                          }}
                        >
                          حفظ الرف
                        </Button>
                      </>
                    )}
                    {order.shelf_location && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        رف: {order.shelf_location}
                      </span>
                    )}
                    {order.status === 'ready' && order.shelf_location && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white mr-auto"
                        disabled={updateMutation.isPending}
                        onClick={e => {
                          e.preventDefault();
                          updateMutation.mutate({ id: order.id, data: { status: 'completed' } });
                        }}
                      >
                        <Truck className="w-3 h-3 ml-1" />
                        تم التسليم
                      </Button>
                    )}
                  </div>
                )}

              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}