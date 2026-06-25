import React from 'react';
import { Store, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import MapLocationPicker from './MapLocationPicker';

const DELIVERY_FEE = 25;

export default function BookingTypeSelector({ bookingType, address, location, onTypeChange, onAddressChange, onLocationChange }) {
  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-stone-600 mb-3">نوع الخدمة</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => onTypeChange('in_store')}
          className={cn(
            "p-4 rounded-xl border-2 text-center transition-all",
            bookingType === 'in_store'
              ? "border-amber-500 bg-amber-50"
              : "border-stone-200 hover:border-amber-200"
          )}
        >
          <Store className={cn("w-7 h-7 mx-auto mb-2", bookingType === 'in_store' ? "text-amber-500" : "text-stone-400")} />
          <p className={cn("font-bold text-sm", bookingType === 'in_store' ? "text-amber-700" : "text-stone-600")}>
            استلام من المحل
          </p>
          <p className="text-xs text-stone-400 mt-0.5">مجاني</p>
        </button>
        <button
          onClick={() => onTypeChange('home_visit')}
          className={cn(
            "p-4 rounded-xl border-2 text-center transition-all",
            bookingType === 'home_visit'
              ? "border-amber-500 bg-amber-50"
              : "border-stone-200 hover:border-amber-200"
          )}
        >
          <Truck className={cn("w-7 h-7 mx-auto mb-2", bookingType === 'home_visit' ? "text-amber-500" : "text-stone-400")} />
          <p className={cn("font-bold text-sm", bookingType === 'home_visit' ? "text-amber-700" : "text-stone-600")}>
            زيارة منزلية
          </p>
          <p className="text-xs text-stone-400 mt-0.5">+{DELIVERY_FEE} ر.س</p>
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