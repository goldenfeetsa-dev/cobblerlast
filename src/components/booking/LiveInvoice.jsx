import React from 'react';
import { Receipt, Tag, Truck, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

const VAT_RATE = 0.15;

export default function LiveInvoice({ service, bookingType, className }) {
  if (!service) return null;

  const servicePrice = service.price || 0;
  const deliveryFee = bookingType === 'home_visit' ? 25 : 0;
  const subtotal = servicePrice + deliveryFee;
  const vat = +(subtotal * VAT_RATE).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);

  return (
    <div className={cn("bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl p-5", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-5 h-5 text-amber-400" />
        <h3 className="font-bold text-sm text-amber-400">الفاتورة 
</h3>
      </div>
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-stone-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            {service.name_ar}
          </span>
          <span className="font-medium">{servicePrice} ر.س</span>
        </div>
        {bookingType === 'home_visit' && <div className="flex items-center justify-between text-stone-400">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              رسوم التوصيل
            </span>
            <span>{deliveryFee} ر.س</span>
          </div>
        }
        <div className="flex items-center justify-between text-stone-400">
          <span className="flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5" />
            ضريبة القيمة المضافة (15%)
          </span>
          <span>{vat} ر.س</span>
        </div>
        <div className="border-t border-stone-700 pt-2.5 flex items-center justify-between">
          <span className="font-bold text-white">الإجمالي</span>
          <span className="text-xl font-black text-amber-400">{total} ر.س</span>
        </div>
      </div>
    </div>);

}