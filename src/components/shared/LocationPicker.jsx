import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, LocateFixed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icons reference image paths that don't survive
// bundlers — without this the pin renders as a broken image.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SHOP_LAT = 24.7136;
const SHOP_LNG = 46.6753;

function ClickHandler({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/**
 * خريطة تفاعلية حقيقية لتحديد موقع التوصيل — اضغط أي مكان على الخريطة
 * لتثبيت الدبوس، أو اسحبه لتعديل الموقع بدقة، أو اضغط "موقعي الحالي"
 * لتحديده تلقائياً عبر GPS. أي من الطريقتين تحفظ الإحداثيات + العنوان.
 */
export default function LocationPicker({ onLocationSelect, initialLat, initialLng }) {
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pin, setPin] = useState(initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null);
  const [addressText, setAddressText] = useState('');
  const mapRef = useRef(null);

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

  const placePin = useCallback((lat, lng) => {
    setPin({ lat, lng });
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const locateMe = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        placePin(latitude, longitude);
        mapRef.current?.flyTo([latitude, longitude], 16);
        setLocating(false);
      },
      () => { setLocating(false); alert('تعذّر تحديد موقعك تلقائياً — اضغط على الخريطة لتحديد الموقع يدوياً.'); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          اضغط على الخريطة لتحديد موقع التوصيل
        </label>
        <Button
          type="button" size="sm" variant="outline" onClick={locateMe} disabled={locating}
          className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 h-8"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <LocateFixed className="w-3.5 h-3.5 ml-1" />}
          موقعي الحالي
        </Button>
      </div>

      <div className="relative rounded-xl overflow-hidden border-2 border-stone-200 hover:border-amber-400 transition-colors" style={{ height: 260 }}>
        <MapContainer
          center={pin ? [pin.lat, pin.lng] : [SHOP_LAT, SHOP_LNG]}
          zoom={pin ? 16 : 12}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={placePin} />
          {pin && (
            <Marker
              position={[pin.lat, pin.lng]}
              draggable
              eventHandlers={{ dragend: (e) => { const { lat, lng } = e.target.getLatLng(); placePin(lat, lng); } }}
            />
          )}
        </MapContainer>
        {!pin && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-[400]">
            <div className="bg-white/95 rounded-xl px-4 py-2 text-sm text-stone-700 font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              اضغط في أي مكان على الخريطة لتثبيت موقعك
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          جارٍ تحديد العنوان...
        </div>
      )}
      {addressText && !loading && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-right">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">العنوان المحدد (يمكنك سحب الدبوس لتعديله):</p>
          <p className="text-stone-700 leading-relaxed">{addressText}</p>
        </div>
      )}
    </div>
  );
}
