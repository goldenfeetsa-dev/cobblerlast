import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Clock, Phone, Search, Scissors, Store, Truck, CheckCircle, XCircle, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { label: 'قيد الانتظار', icon: AlertCircle, color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  confirmed: { label: 'مؤكد', icon: CheckCircle, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  in_progress: { label: 'جارٍ التنفيذ', icon: RefreshCw, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  completed: { label: 'مكتمل', icon: CheckCircle, color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  cancelled: { label: 'ملغى', icon: XCircle, color: 'text-red-400 border-red-500/30 bg-red-500/10' },
};

export default function MyBookings() {
  const [phone, setPhone] = useState('');
  const [searched, setSearched] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings', searchPhone],
    queryFn: () => base44.entities.Booking.filter({ customer_phone: searchPhone }),
    enabled: !!searchPhone,
  });

  const handleSearch = () => {
    if (!phone.trim()) return;
    setSearchPhone(phone.trim());
    setSearched(true);
  };

  return (
    <div className="min-h-screen py-8 px-4 font-tajawal" dir="rtl"
      style={{ background: 'linear-gradient(135deg, #120800 0%, #1E1000 40%, #2A1500 70%, #1A0C00 100%)' }}>
      {/* Subtle texture */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C9A84C 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="max-w-lg mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/booking" className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
            style={{ color: 'rgba(201,168,76,0.6)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#C9A84C'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,168,76,0.6)'}>
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
            <Scissors className="w-3 h-3" />
            تتبع حجوزاتك
          </div>
          <h1 className="text-3xl font-black" style={{ color: '#F5EDD8' }}>حجوزاتي</h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(245,237,216,0.4)' }}>أدخل رقم جوالك لعرض حجوزاتك</p>
        </div>

        {/* Search */}
        <div className="rounded-2xl p-5 mb-6 flex gap-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)' }}>
          <Input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="05XXXXXXXX"
            className="text-right border-0 bg-transparent text-base"
            style={{ color: '#F5EDD8', caretColor: '#C9A84C' }}
            dir="ltr"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}
            className="px-6 py-2 rounded-xl font-bold text-black transition-all hover:scale-105 flex items-center gap-2 shrink-0"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
            <Search className="w-4 h-4" />
            بحث
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-t-[#C9A84C] rounded-full animate-spin" style={{ borderColor: 'rgba(201,168,76,0.2)', borderTopColor: '#C9A84C' }} />
          </div>
        )}

        {searched && !isLoading && bookings.length === 0 && (
          <div className="text-center py-14 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)' }}>
              <Scissors className="w-8 h-8" style={{ color: 'rgba(201,168,76,0.4)' }} />
            </div>
            <p style={{ color: 'rgba(245,237,216,0.4)' }}>لا توجد حجوزات لهذا الرقم</p>
            <Link to="/book">
              <button className="mt-5 px-7 py-3 rounded-full font-bold text-black transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>احجز الآن</button>
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {bookings.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(booking => {
            const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            return (
              <div key={booking.id} className="rounded-2xl p-5 transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-black text-base" style={{ color: '#F5EDD8' }}>{booking.service_name}</p>
                    <p className="text-xs mt-0.5 font-mono" style={{ color: 'rgba(201,168,76,0.5)' }}>#{booking.booking_number}</p>
                  </div>
                  <span className={cn("text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5", status.color)}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>
                <div className="space-y-2 text-sm" style={{ color: 'rgba(245,237,216,0.5)' }}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0" style={{ color: '#C9A84C' }} />
                    <span>
                      {booking.booking_date && format(new Date(booking.booking_date), 'EEEE d MMMM yyyy', { locale: ar })} — {booking.booking_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.booking_type === 'home_visit'
                      ? <Truck className="w-4 h-4 shrink-0" style={{ color: '#C9A84C' }} />
                      : <Store className="w-4 h-4 shrink-0" style={{ color: '#C9A84C' }} />}
                    <span>{booking.booking_type === 'home_visit' ? 'زيارة منزلية' : 'استلام من المحل'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}>
                  <span className="text-xs" style={{ color: 'rgba(245,237,216,0.3)' }}>الإجمالي</span>
                  <span className="font-black text-lg" style={{ color: '#C9A84C' }}>{booking.total_price} ر.س</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}