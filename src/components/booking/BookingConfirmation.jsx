import React from 'react';
import { CheckCircle, Calendar, Store, Truck, Receipt, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { SarAmount } from '@/components/shared/SarCurrency';

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
      <div className="w-20 h-20 border border-white/20 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-10 h-10 text-[#ece8df]" />
      </div>
      <h2 className="text-2xl font-black text-[#ece8df] mb-1">تم الحجز بنجاح</h2>
      <p className="text-[#bdb8ad] mb-6">سنتواصل معك لتأكيد الموعد</p>

      {/* Booking Number */}
      <div className="bg-white/5 border border-white/20 rounded-none p-4 mb-6 flex items-center justify-between">
        <div className="text-right">
          <p className="text-xs text-[#bdb8ad] mb-0.5">رقم الحجز</p>
          <p className="text-2xl font-black text-[#ece8df] tracking-wider">{booking.booking_number}</p>
        </div>
        <button onClick={copyNumber} className="w-10 h-10 rounded-none border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
          <Copy className="w-4 h-4 text-[#bdb8ad]" />
        </button>
      </div>

      {/* Details */}
      <div className="bg-[#131315] border border-white/10 rounded-none p-5 text-right space-y-3 mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-[#ece8df] flex-shrink-0" />
          <div>
            <p className="text-xs text-[#8d8a82]">الموعد</p>
            <p className="font-bold text-[#ece8df] text-sm">
              {booking.booking_date && format(new Date(booking.booking_date), 'EEEE d MMMM yyyy', { locale: ar })} — {booking.booking_time}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Receipt className="w-4 h-4 text-[#ece8df] flex-shrink-0" />
          <div>
            <p className="text-xs text-[#8d8a82]">الخدمة</p>
            <p className="font-bold text-[#ece8df] text-sm">{booking.service_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {booking.booking_type === 'home_visit' ? <Truck className="w-4 h-4 text-[#ece8df]" /> : <Store className="w-4 h-4 text-[#ece8df]" />}
          <div>
            <p className="text-xs text-[#8d8a82]">نوع الخدمة</p>
            <p className="font-bold text-[#ece8df] text-sm">
              {booking.booking_type === 'home_visit' ? 'توصيل' : 'استلام من المحل'}
              {booking.address && ` — ${booking.address}`}
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 pt-3 flex items-center justify-between">
          <span className="text-[#bdb8ad] text-sm">الإجمالي مع الضريبة</span>
          <span className="text-xl font-black text-[#ece8df]"><SarAmount value={total} /></span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/my-bookings" className="flex-1">
          <Button variant="outline" className="w-full">تتبع حجزك</Button>
        </Link>
        <Link to="/" className="flex-1">
          <Button className="w-full bg-[#ece8df] hover:bg-white text-[#0b0b0c] font-bold rounded-none">
            العودة للرئيسية
          </Button>
        </Link>
      </div>
    </div>
  );
}