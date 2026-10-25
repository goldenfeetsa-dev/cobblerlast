import React, { useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { MapPin, LocateFixed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';

import { pinIcon, DARK_TILES } from './ShopMap';

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
  const [geoErr, setGeoErr] = useState('');
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
      () => { setLocating(false); setGeoErr('تعذّر تحديد موقعك تلقائياً — اضغط على الخريطة لتحديد الموقع يدوياً.'); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-[#ece8df] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#ece8df]" />
          اضغط على الخريطة لتحديد موقع التوصيل
        </label>
        <Button
          type="button" size="sm" variant="outline" onClick={locateMe} disabled={locating}
          className="text-xs border-white/20 text-[#ece8df] hover:bg-white/5 h-8"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <LocateFixed className="w-3.5 h-3.5 ml-1" />}
          موقعي الحالي
        </Button>
      </div>

      <div className="relative rounded-none overflow-hidden border border-white/15 hover:border-white/40 transition-colors" style={{ height: 260 }}>
        <MapContainer
          center={pin ? [pin.lat, pin.lng] : [SHOP_LAT, SHOP_LNG]}
          zoom={pin ? 16 : 12}
          style={{ height: '100%', width: '100%', background: '#0b0b0c' }}
          zoomControl={false}
          ref={mapRef}
        >
          <TileLayer url={DARK_TILES} subdomains="abcd" maxZoom={19} attribution="© OpenStreetMap · © CARTO" />
          <ClickHandler onPick={placePin} />
          {pin && (
            <Marker
              position={[pin.lat, pin.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{ dragend: (e) => { const { lat, lng } = e.target.getLatLng(); placePin(lat, lng); } }}
            />
          )}
        </MapContainer>
        {!pin && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-[400]">
            <div className="bg-[#ece8df] text-[#0b0b0c] px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              اضغط في أي مكان على الخريطة لتثبيت موقعك
            </div>
          </div>
        )}
      </div>

      {geoErr && <p className="text-sm text-[#bdb8ad]">{geoErr}</p>}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-[#bdb8ad]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          جارٍ تحديد العنوان...
        </div>
      )}
      {addressText && !loading && (
        <div className="bg-white/5 border border-white/20 rounded-none p-3 text-sm text-right">
          <p className="text-xs text-[#ece8df] font-semibold mb-1">العنوان المحدد (يمكنك سحب الدبوس لتعديله):</p>
          <p className="text-[#ece8df] leading-relaxed">{addressText}</p>
        </div>
      )}
    </div>
  );
}
