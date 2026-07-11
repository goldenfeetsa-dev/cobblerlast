import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import PhotoCarousel from '@/components/pos/PhotoCarousel';
import ReceiptView from '@/components/pos/ReceiptView';
import { getSession } from '@/lib/sessionStore';
import { shouldHidePhotos } from '@/lib/photoCleanup';
import { ArrowLeft, Clock, User, Package, CreditCard, MapPin, Star, RotateCcw, RefreshCw, XCircle, PauseCircle, MessageCircle, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const ITEM_LABELS = {
  shoes: 'أحذية', bag: 'حقيبة', dress: 'فستان', suit: 'بدلة',
  jacket: 'جاكيت', pants: 'بنطال', shirt: 'قميص', other: 'أخرى'
};

const STATUS_LABELS = {
  pending: 'قيد الانتظار ⏳',
  in_progress: 'جارٍ التنفيذ 🔧',
  ready: 'جاهز للاستلام ✅',
  completed: 'مكتمل 🎉',
  cancelled: 'ملغى ❌',
  on_hold: 'متوقف مؤقتاً ⏸',
  returned: 'مُسترجع 🔄',
  exchanged: 'مُستبدَل 🔀',
};

function buildWhatsAppMessage(order, newStatus) {
  const statusLabel = STATUS_LABELS[newStatus] || newStatus;
  const itemLabel = ITEM_LABELS[order.item_type] || order.item_type;
  return `السلام عليكم ${order.customer_name} 👋\n\nنود إعلامك بتحديث حالة طلبك:\n\n🔖 رقم الطلب: ${order.order_number}\n📦 القطعة: ${itemLabel}\n📊 الحالة الجديدة: ${statusLabel}\n💰 المبلغ: ${order.total_price?.toFixed(2)} ر.س\n\nشكراً لثقتك بـ إبرة وخيط الإسكافي 🌟`;
}

function sendWhatsAppNotification(order, newStatus) {
  if (!order.customer_phone) return;
  const phone = order.customer_phone.replace(/\D/g, '');
  const fullPhone = phone.startsWith('0') ? '966' + phone.slice(1) : phone.startsWith('966') ? phone : '966' + phone;
  const msg = buildWhatsAppMessage(order, newStatus);
  window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function sendEmailNotification(order, newStatus) {
  if (!order.customer_email && !order.customer_phone) return;
  const statusLabel = STATUS_LABELS[newStatus] || newStatus;
  const itemLabel = ITEM_LABELS[order.item_type] || order.item_type;
  const emailTarget = order.customer_email;
  if (!emailTarget) return;
  await base44.integrations.Core.SendEmail({
    to: emailTarget,
    subject: `تحديث حالة طلبك ${order.order_number} — إبرة وخيط الإسكافي`,
    body: `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #1A0C00; color: #F5EDD8; border-radius: 12px;">
  <h2 style="color: #C9A84C; margin-bottom: 8px;">إبرة وخيط الإسكافي</h2>
  <p style="color: rgba(245,237,216,0.7);">السلام عليكم ${order.customer_name}،</p>
  <p style="color: rgba(245,237,216,0.7);">نود إعلامك بتحديث حالة طلبك:</p>
  <div style="background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3); border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 4px 0;"><strong style="color: #C9A84C;">رقم الطلب:</strong> ${order.order_number}</p>
    <p style="margin: 4px 0;"><strong style="color: #C9A84C;">القطعة:</strong> ${itemLabel}</p>
    <p style="margin: 4px 0;"><strong style="color: #C9A84C;">الحالة الجديدة:</strong> ${statusLabel}</p>
    <p style="margin: 4px 0;"><strong style="color: #C9A84C;">المبلغ:</strong> ${order.total_price?.toFixed(2)} ر.س</p>
  </div>
  <p style="color: rgba(245,237,216,0.5); font-size: 13px;">شكراً لثقتك بنا 🌟</p>
</div>`
  });
}

export default function OrderDetails() {
  const pathParts = window.location.pathname.split('/');
  const orderId = pathParts[pathParts.length - 1];
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = getSession();
  const isAdmin = ['admin','owner','manager'].includes(session?.role);
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_at', 200),
    initialData: [],
  });

  const order = orders.find(o => o.id === orderId);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Order.update(id, { status: status }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('تم تحديث الحالة', {
        action: {
          label: '📱 أبلغ العميل واتساب',
          onClick: () => sendWhatsAppNotification(order, vars.status),
        },
        duration: 8000,
      });
      if (order?.customer_email) sendEmailNotification(order, vars.status).catch(() => {});
    },
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Order.update(id, { payment_status: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('تم تحديث حالة الدفع');
    },
  });

  const updatePaymentMethod = useMutation({
    mutationFn: ({ id, method }) => base44.entities.Order.update(id, { payment_method: method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('تم تحديث طريقة الدفع');
    },
  });

  const adminAction = useMutation({
    mutationFn: ({ id, status, extra }) => base44.entities.Order.update(id, { status: status, ...extra }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      const labels = { cancelled: 'إلغاء الفاتورة', returned: 'استرجاع', exchanged: 'استبدال', on_hold: 'توقيف الطلب' };
      toast.success(`تم تنفيذ: ${labels[vars.status] || 'تحديث'}`, {
        action: {
          label: '📱 أبلغ العميل واتساب',
          onClick: () => sendWhatsAppNotification(order, vars.status),
        },
        duration: 8000,
      });
      if (order?.customer_email) sendEmailNotification(order, vars.status).catch(() => {});
    },
  });

  const handleHoldSubmit = () => {
    adminAction.mutate({ id: order.id, status: 'on_hold', extra: { hold_reason: holdReason } });
    setHoldDialogOpen(false);
    setHoldReason('');
  };

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">الطلب غير موجود</p>
        <Button variant="outline" onClick={() => navigate('/orders')}>
          <ArrowLeft className="w-4 h-4 ml-2" />
          العودة للطلبات
        </Button>
      </div>
    );
  }

  const createdDate = order.created_at ? new Date(order.created_at) : new Date();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-mono">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">
              {format(createdDate, 'yyyy/MM/dd HH:mm:ss')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select
            value={order.status}
            onValueChange={v => updateStatus.mutate({ id: order.id, status: v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="in_progress">جارٍ التنفيذ</SelectItem>
            <SelectItem value="ready">جاهز</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغى</SelectItem>
            <SelectItem value="on_hold">متوقف</SelectItem>
            <SelectItem value="returned">مُسترجع</SelectItem>
            <SelectItem value="exchanged">مُستبدَل</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                onClick={() => setHoldDialogOpen(true)}
              >
                <PauseCircle className="w-3.5 h-3.5 ml-1" />
                متوقف
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                    <RotateCcw className="w-3.5 h-3.5 ml-1" />
                    استرجاع
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد الاسترجاع</AlertDialogTitle>
                    <AlertDialogDescription>هل تريد تسجيل هذا الطلب كمُسترجع؟</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => adminAction.mutate({ id: order.id, status: 'returned' })} className="bg-amber-600 hover:bg-amber-700">تأكيد</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                    <RefreshCw className="w-3.5 h-3.5 ml-1" />
                    استبدال
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد الاستبدال</AlertDialogTitle>
                    <AlertDialogDescription>هل تريد تسجيل هذا الطلب كمُستبدَل؟</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => adminAction.mutate({ id: order.id, status: 'exchanged' })} className="bg-blue-600 hover:bg-blue-700">تأكيد</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                    <XCircle className="w-3.5 h-3.5 ml-1" />
                    إلغاء الفاتورة
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>إلغاء الفاتورة</AlertDialogTitle>
                    <AlertDialogDescription>هل أنت متأكد من إلغاء هذه الفاتورة؟ لن تُحتسب في التقارير المالية.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => adminAction.mutate({ id: order.id, status: 'cancelled' })} className="bg-destructive hover:bg-destructive/90">تأكيد الإلغاء</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">التفاصيل</TabsTrigger>
          <TabsTrigger value="receipt">الفاتورة والباركود</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Photos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">الصور</CardTitle>
              </CardHeader>
              <CardContent>
                {shouldHidePhotos(order) ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                    <span className="text-3xl">🗑️</span>
                    <p className="text-sm text-center">تم حذف الصور تلقائياً بعد أسبوعين من إكمال الطلب</p>
                  </div>
                ) : (
                  <PhotoCarousel photos={order.photos || []} />
                )}
              </CardContent>
            </Card>

            {/* Order Info */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">العميل</p>
                        <p className="font-medium">{order.customer_name}</p>
                        {order.customer_phone && <p className="text-sm text-muted-foreground">{order.customer_phone}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {order.customer_phone && (
                        <button
                          onClick={() => sendWhatsAppNotification(order, order.status)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity"
                          style={{ background: '#25D366' }}
                          title="إرسال تحديث الحالة عبر واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />واتساب
                        </button>
                      )}
                      {order.customer_email && (
                        <button
                          onClick={async () => {
                            try {
                              await sendEmailNotification(order, order.status);
                              toast.success('تم إرسال البريد الإلكتروني');
                            } catch (err) {
                              toast.error('تعذّر إرسال البريد الإلكتروني: ميزة إرسال الإيميل تحتاج ربط خدمة بريد فعلية (لم تُفعّل بعد)');
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity bg-blue-500"
                          title="إرسال تحديث الحالة عبر البريد"
                        >
                          <Mail className="w-3.5 h-3.5" />بريد
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">الموظف</p>
                      <p className="font-medium">{order.employee_name || '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">القطعة</p>
                      <p className="font-medium">{ITEM_LABELS[order.item_type] || order.item_type} × {order.quantity || 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">التسليم</p>
                      <p className="font-medium">{order.delivery_method === 'pickup' ? 'استلام من المحل' : 'توصيل'}</p>
                      {order.delivery_address && <p className="text-sm text-muted-foreground">{order.delivery_address}</p>}
                    </div>
                  </div>
                  {order.hold_reason && (
                    <div className="pt-2 border-t border-yellow-200 bg-yellow-50 rounded-lg p-2 mt-2">
                      <p className="text-xs text-yellow-700 font-bold mb-1">⏸ سبب التوقف</p>
                      <p className="text-sm text-yellow-800">{order.hold_reason}</p>
                    </div>
                  )}
                  {order.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                      <p className="text-sm">{order.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">الإجمالي</p>
                        <p className="text-2xl font-bold">{order.total_price?.toFixed(2)} <span className="text-sm font-normal">SAR</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge
                      className={`cursor-pointer ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      onClick={() => updatePayment.mutate({ 
                        id: order.id, 
                        status: order.payment_status === 'paid' ? 'unpaid' : 'paid' 
                      })}
                    >
                      {order.payment_status === 'paid' ? '✅ مدفوع' : '⏳ غير مدفوع'} (اضغط للتغيير)
                    </Badge>
                    {isAdmin ? (
                      <Select
                        value={order.payment_method || ''}
                        onValueChange={v => updatePaymentMethod.mutate({ id: order.id, method: v })}
                      >
                        <SelectTrigger className="h-6 text-xs w-28">
                          <SelectValue placeholder="طريقة الدفع" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">نقد</SelectItem>
                          <SelectItem value="network">شبكة</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{order.payment_method === 'cash' ? 'نقد' : order.payment_method === 'network' ? 'شبكة' : order.payment_method}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Star className="w-4 h-4 text-primary" />
                    <span className="text-sm">+{order.points_earned || 0} نقطة ولاء مكتسبة</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="receipt">
          <ReceiptView order={order} />
        </TabsContent>
      </Tabs>

      {/* Hold Reason Dialog */}
      <Dialog open={holdDialogOpen} onOpenChange={setHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>توقيف الطلب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">اكتب سبب توقيف هذا الطلب</p>
            <Textarea
              value={holdReason}
              onChange={e => setHoldReason(e.target.value)}
              placeholder="مثال: ينتظر توفر قطع الغيار..."
              className="h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleHoldSubmit}
              disabled={!holdReason.trim()}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              <PauseCircle className="w-4 h-4 ml-2" />
              تأكيد التوقيف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}