import React from 'react';
import { CheckCircle, Calendar, Store, Truck, Receipt, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const VAT_RATE = 0.15;

export default function BookingConfirmation({ booking }) {
  const deliveryFee = booking.booking_type === 'home_visit' ? 25 : 0;
  const servicePrice = booking.service_price || 0;
  const subtotal = servicePrice + deliveryFee;
  const vat = +(subtotal * VAT_RATE).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);

  const copyNumber = () => {
    navigator.clipboard.writeText(booking.booking_number);
  };

  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-10 h-10 text-green-500" />
      </div>
      <h2 className="text-2xl font-black text-stone-800 mb-1">تم الحجز بنجاح! 🎉</h2>
      <p className="text-stone-500 mb-6">سنتواصل معك لتأكيد الموعد</p>

      {/* Booking Number */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
        <div className="text-right">
          <p className="text-xs text-stone-500 mb-0.5">رقم الحجز</p>
          <p className="text-2xl font-black text-amber-600 tracking-wider">{booking.booking_number}</p>
        </div>
        <button onClick={copyNumber} className="w-10 h-10 bg-white rounded-xl border border-amber-200 flex items-center justify-center hover:bg-amber-100 transition-colors">
          <Copy className="w-4 h-4 text-stone-500" />
        </button>
      </div>

      {/* Details */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 text-right space-y-3 mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-stone-400">الموعد</p>
            <p className="font-bold text-stone-800 text-sm">
              {booking.booking_date && format(new Date(booking.booking_date), 'EEEE d MMMM yyyy', { locale: ar })} — {booking.booking_time}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Receipt className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-stone-400">الخدمة</p>
            <p className="font-bold text-stone-800 text-sm">{booking.service_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {booking.booking_type === 'home_visit' ? <Truck className="w-4 h-4 text-amber-500" /> : <Store className="w-4 h-4 text-amber-500" />}
          <div>
            <p className="text-xs text-stone-400">نوع الخدمة</p>
            <p className="font-bold text-stone-800 text-sm">
              {booking.booking_type === 'home_visit' ? 'زيارة منزلية' : 'استلام من المحل'}
              {booking.address && ` — ${booking.address}`}
            </p>
          </div>
        </div>
        <div className="border-t border-stone-100 pt-3 flex items-center justify-between">
          <span className="text-stone-500 text-sm">الإجمالي مع الضريبة</span>
          <span className="text-xl font-black text-amber-600">{total} ر.س</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/my-bookings" className="flex-1">
          <Button variant="outline" className="w-full">تتبع حجزك</Button>
        </Link>
        <Link to="/" className="flex-1">
          <Button className="w-full bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold">
            العودة للرئيسية
          </Button>
        </Link>
      </div>
    </div>
  );
}