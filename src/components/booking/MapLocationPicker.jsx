import React from 'react';
import LocationPicker from '@/components/shared/LocationPicker';

// غلاف رفيع يحافظ على نفس واجهة الاستدعاء القديمة (props) حتى ما
// نحتاج نعدّل BookingTypeSelector — المكوّن الفعلي الآن خريطة تفاعلية
// حقيقية (اضغط/اسحب) بدل iframe ثابت كان يدعم GPS بس.
export default function MapLocationPicker({ onLocationSelect, selectedAddress, initialLat, initialLng }) {
  return <LocationPicker onLocationSelect={onLocationSelect} initialLat={initialLat} initialLng={initialLng} />;
}
