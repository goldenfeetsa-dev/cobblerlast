import React from 'react';
import { Store, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import MapLocationPicker from './MapLocationPicker';
import { SarAmount } from '@/components/shared/SarCurrency';

const DELIVERY_FEE = 25;

export default function BookingTypeSelector({ bookingType, address, location, onTypeChange, onAddressChange, onLocationChange }) {
  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-[#bdb8ad] mb-3">نوع الخدمة</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => onTypeChange('in_store')}
          className={cn(
            "p-4 rounded-none border-2 text-center transition-all",
            bookingType === 'in_store'
              ? "border-[#ece8df] bg-[#ece8df]/10"
              : "border-white/10 hover:border-white/30"
          )}
        >
          <Store className={cn("w-7 h-7 mx-auto mb-2", bookingType === 'in_store' ? "text-[#ece8df]" : "text-[#8d8a82]")} />
          <p className={cn("font-bold text-sm", bookingType === 'in_store' ? "text-[#ece8df]" : "text-[#bdb8ad]")}>
            استلام من المحل
          </p>
          <p className="text-xs text-[#8d8a82] mt-0.5">مجاني</p>
        </button>
        <button
          onClick={() => onTypeChange('home_visit')}
          className={cn(
            "p-4 rounded-none border-2 text-center transition-all",
            bookingType === 'home_visit'
              ? "border-[#ece8df] bg-[#ece8df]/10"
              : "border-white/10 hover:border-white/30"
          )}
        >
          <Truck className={cn("w-7 h-7 mx-auto mb-2", bookingType === 'home_visit' ? "text-[#ece8df]" : "text-[#8d8a82]")} />
          <p className={cn("font-bold text-sm", bookingType === 'home_visit' ? "text-[#ece8df]" : "text-[#bdb8ad]")}>
            توصيل
          </p>
          <p className="text-xs text-[#8d8a82] mt-0.5">+<SarAmount value={DELIVERY_FEE} /></p>
        </button>
      </div>

      {bookingType === 'home_visit' && (
        <MapLocationPicker
          selectedAddress={address}
          onLocationSelect={({ lat, lng, address: addr }) => {
            onAddressChange(addr);
            onLocationChange && onLocationChange({ lat, lng });
          }}
        />
      )}
    </div>
  );
}