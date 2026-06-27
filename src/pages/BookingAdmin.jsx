import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseApi';
import { Calendar, Phone, Store, Truck, Search, Camera, MapPin, Send, CheckSquare, Square, MessageCircle, Eye } from 'lucide-react';
import { getSession } from '@/lib/sessionStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending:     { label: 'قيد الانتظار',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  confirmed:   { label: 'مؤكد',           color: 'bg-blue-100 text-blue-700 border-blue-200' },
  in_progress: { label: 'جارٍ الشغل',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
  completed:   { label: 'انتهينا',        color: 'bg-green-100 text-green-700 border-green-200' },
  cancelled:   { label: 'ملغى',           color: 'bg-red-100 text-red-700 border-red-200' },
};

export default function BookingAdmin() {
  const session = getSession();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [msgTemplate, setMsgTemplate] = useState('يا هلا يا {اسم العميل}، عندنا لك عرض خاص من إبرة وخيط الإسكافي! 🧵\nتواصل معنا الحين: https://wa.me/966549678191');
  const [photosBooking, setPhotosBooking] = useState(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-booking_date', 200),
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Booking.update(id, { status }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      const labels = { confirmed: 'استلمناه ✓', in_progress: 'جارٍ الشغل 🔧', completed: 'انتهينا ✅' };
      toast({ title: `تم: ${labels[vars.status] || 'تحديث الحالة'}` });
    },
  });

  const filtered = bookings.filter(b => {
    const matchSearch = !search || b.customer_name?.includes(search) || b.customer_phone?.includes(search) || b.booking_number?.includes(search);
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    revenue: bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.total_price || 0), 0),
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(b => b.id));
    }
  };

  const sendWhatsappMessages = () => {
    const targets = bookings.filter(b => selectedIds.includes(b.id));
    targets.forEach(b => {
      const msg = msgTemplate.replace('{اسم العميل}', b.customer_name || 'عزيزي العميل');
      const phone = b.customer_phone?.replace(/^0/, '966').replace(/\D/g, '');
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    });
    toast({ title: `تم فتح ${targets.length} محادثة واتساب` });
    setWhatsappOpen(false);
    setSelectedIds([]);
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-800">إدارة الحجوزات</h1>
          <p className="text-stone-500 text-sm mt-1">متابعة وإدارة جميع المواعيد</p>
        </div>
        {selectedIds.length > 0 && (
          <Button
            onClick={() => setWhatsappOpen(true)}
            className="bg-[#25D366] hover:bg-[#20bb5a] text-white gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            إرسال واتساب ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'الكل',      value: stats.total,               color: 'text-stone-800' },
          { label: 'انتظار',    value: stats.pending,             color: 'text-yellow-600' },
          { label: 'مؤكدة',    value: stats.confirmed,           color: 'text-blue-600' },
          { label: 'مكتملة',   value: stats.completed,           color: 'text-green-600' },
          { label: 'الإيرادات', value: `${stats.revenue.toFixed(0)} ر.س`, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
            <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
            <p className="text-xs text-stone-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الجوال أو رقم الحجز..."
            className="pr-10 text-right"
            dir="rtl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Select all */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-sm text-stone-500">
          <button onClick={toggleAll} className="flex items-center gap-1.5 hover:text-stone-800 transition-colors">
            {selectedIds.length === filtered.length && filtered.length > 0
              ? <CheckSquare className="w-4 h-4 text-amber-500" />
              : <Square className="w-4 h-4" />}
            تحديد الكل
          </button>
          {selectedIds.length > 0 && (
            <span className="text-amber-600 font-medium">({selectedIds.length} محدد)</span>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Bookings List */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {filtered.length === 0 && !isLoading ? (
          <div className="text-center py-12 text-stone-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>لا توجد حجوزات</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered.map(booking => {
              const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
              const hasPhotos = booking.item_photos?.length > 0;
              const isSelected = selectedIds.includes(booking.id);

              return (
                <div key={booking.id} className={cn("p-4 hover:bg-stone-50 transition-colors", isSelected && "bg-amber-50/50")}>
                  <div className="flex items-start gap-3 flex-wrap">
                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(booking.id)} className="mt-1 flex-shrink-0">
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-amber-500" />
                        : <Square className="w-4 h-4 text-stone-300" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-stone-800">{booking.customer_name}</span>
                        <span className="text-xs text-stone-400">#{booking.booking_number}</span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", sc.color)}>{sc.label}</span>
                        {hasPhotos && (
                          <button
                            onClick={() => setPhotosBooking(booking)}
                            className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100 transition-colors"
                          >
                            <Camera className="w-3 h-3" />
                            {booking.item_photos.length} صور
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{booking.customer_phone}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{booking.booking_date} — {booking.booking_time}</span>
                        <span className="flex items-center gap-1">
                          {booking.booking_type === 'home_visit' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                          {booking.service_name}
                        </span>
                        {booking.latitude && (
                          <a
                            href={`https://maps.google.com/?q=${booking.latitude},${booking.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:underline"
                          >
                            <MapPin className="w-3 h-3" />
                            موقع العميل
                          </a>
                        )}
                        <span className="font-bold text-amber-600">{booking.total_price} ر.س</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {booking.status === 'pending' && (
                        <Button size="sm" onClick={() => updateStatus.mutate({ id: booking.id, status: 'confirmed' })} className="bg-blue-500 hover:bg-blue-400 text-white text-xs h-8">
                          استلمناه ✓
                        </Button>
                      )}
                      {booking.status === 'confirmed' && (
                        <Button size="sm" onClick={() => updateStatus.mutate({ id: booking.id, status: 'in_progress' })} className="bg-purple-500 hover:bg-purple-400 text-white text-xs h-8">
                          جارٍ الشغل 🔧
                        </Button>
                      )}
                      {booking.status === 'in_progress' && (
                        <Button size="sm" onClick={() => updateStatus.mutate({ id: booking.id, status: 'completed' })} className="bg-green-500 hover:bg-green-400 text-white text-xs h-8">
                          انتهينا ✅
                        </Button>
                      )}
                      {!['completed', 'cancelled'].includes(booking.status) && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: booking.id, status: 'cancelled' })} className="border-red-200 text-red-500 hover:bg-red-50 text-xs h-8">
                          إلغاء
                        </Button>
                      )}
                      <a href={`https://wa.me/${booking.customer_phone?.replace(/^0/, '966').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="border-green-200 text-green-600 hover:bg-green-50 text-xs h-8">
                          <MessageCircle className="w-3 h-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photos Dialog */}
      <Dialog open={!!photosBooking} onOpenChange={() => setPhotosBooking(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-amber-500" />
              صور القطعة — {photosBooking?.customer_name}
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-stone-500 -mt-2 mb-3">
            الخدمة: {photosBooking?.service_name} | الموعد: {photosBooking?.booking_date} {photosBooking?.booking_time}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {photosBooking?.item_photos?.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative">
                <img src={url} alt={`صورة ${i + 1}`} className="w-full h-48 object-cover rounded-xl border border-stone-200 group-hover:opacity-90 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/50 rounded-full p-2">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Bulk Dialog */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              إرسال رسالة واتساب جماعية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-stone-500">
              سيتم إرسال رسالة لـ <span className="font-bold text-stone-800">{selectedIds.length}</span> عميل
            </p>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-2 block">
                نص الرسالة
                <span className="text-xs text-stone-400 font-normal mr-2">(استخدم &#123;اسم العميل&#125; للتخصيص)</span>
              </label>
              <Textarea
                value={msgTemplate}
                onChange={e => setMsgTemplate(e.target.value)}
                rows={5}
                className="text-right resize-none"
                dir="rtl"
              />
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-500">
              💡 ملاحظة: سيتم فتح محادثة واتساب منفصلة لكل عميل. يتطلب مراجعة يدوية للإرسال.
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>إلغاء</Button>
            <Button
              onClick={sendWhatsappMessages}
              className="bg-[#25D366] hover:bg-[#20bb5a] text-white gap-2"
            >
              <Send className="w-4 h-4" />
              إرسال ({selectedIds.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}