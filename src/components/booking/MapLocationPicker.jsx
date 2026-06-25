import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, LocateFixed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SHOP_LAT = 24.6908;
const SHOP_LNG = 46.7219;

export default function MapLocationPicker({ onLocationSelect, selectedAddress }) {
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapLat, setMapLat] = useState(SHOP_LAT);
  const [mapLng, setMapLng] = useState(SHOP_LNG);
  const [pinLat, setPinLat] = useState(null);
  const [pinLng, setPinLng] = useState(null);
  const [addressText, setAddressText] = useState('');

  // Reverse geocode using Nominatim (free, no API key)
  const reverseGeocode = useCallback(async (lat, lng) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`,
        { headers: { 'Accept-Language': 'ar' } }
      );
      const data = await res.json();
      const addr = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddressText(addr);
      onLocationSelect({ lat, lng, address: addr });
    } catch {
      const addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddressText(addr);
      onLocationSelect({ lat, lng, address: addr });
    }
    setLoading(false);
  }, [onLocationSelect]);

  const locateMe = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPinLat(latitude);
        setPinLng(longitude);
        setMapLat(latitude);
        setMapLng(longitude);
        reverseGeocode(latitude, longitude);
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert('تعذّر تحديد موقعك. تأكد من تفعيل الصلاحيات.');
      }
    );
  };

  // Build the OpenStreetMap embed URL with a marker if pin is set
  const mapSrc = pinLat
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${pinLng - 0.01},${pinLat - 0.01},${pinLng + 0.01},${pinLat + 0.01}&layer=mapnik&marker=${pinLat},${pinLng}`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.02},${mapLat - 0.02},${mapLng + 0.02},${mapLat + 0.02}&layer=mapnik`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-500" />
          حدد موقعك على الخريطة
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={locateMe}
          disabled={locating}
          className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50 h-8"
        >
          {locating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />
          ) : (
            <LocateFixed className="w-3.5 h-3.5 ml-1" />
          )}
          موقعي الحالي
        </Button>
      </div>

      {/* Map iframe */}
      <div className="relative rounded-xl overflow-hidden border-2 border-stone-200 hover:border-amber-400 transition-colors">
        <iframe
          src={mapSrc}
          width="100%"
          height="220"
          style={{ border: 0 }}
          title="اختر موقعك"
          className="w-full"
        />
        {/* overlay instruction */}
        {!pinLat && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="bg-white/90 rounded-xl px-4 py-2 text-sm text-stone-700 font-medium flex items-center gap-2">
              <LocateFixed className="w-4 h-4 text-amber-500" />
              اضغط "موقعي الحالي" لتحديد موقعك
            </div>
          </div>
        )}
      </div>

      {/* Address display */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          جارٍ تحديد العنوان...
        </div>
      )}
      {addressText && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-right">
          <p className="text-xs text-amber-600 font-semibold mb-1">العنوان المحدد:</p>
          <p className="text-stone-700 leading-relaxed">{addressText}</p>
        </div>
      )}
    </div>
  );
}