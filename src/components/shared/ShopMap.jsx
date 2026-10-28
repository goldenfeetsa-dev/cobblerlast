import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// دبوس بسيط بدون صور خارجية (متوافق مع CSP) — مربع عاجي بنقطة سوداء
export const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;background:#ece8df;border:3px solid #0b0b0c;box-shadow:0 0 0 2px #ece8df, 0 0 24px rgba(236,232,223,.55);transform:rotate(45deg)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// خرائط OpenStreetMap القياسية + فلتر CSS يحوّلها للوضع الداكن (أوثق من مزوّد بلاطات داكنة خارجي)
export const DARK_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_SUBDOMAINS = 'abc';
export const MAPS_LINK = 'https://maps.app.goo.gl/dwDGJv8NoGpKPqvDA';

export default function ShopMap({ lat, lng, zoom = 16, height = 320 }) {
  const [failed, setFailed] = useState(false);
  const [show, setShow] = useState(false); // لا تُحمَّل بلاطات الخريطة (طرف ثالث) إلا بنقرة الزائر — حماية خصوصية IP
  const errs = React.useRef(0);
  const ok = React.useRef(false);
  if (!show) {
    return (
      <div style={{ height, background: '#17181b', color: '#ece8df' }} className="shop-map flex flex-col items-center justify-center gap-3 text-center px-4">
        <span className="text-base font-semibold">الرياض، حي العزيزية، شارع الشباب</span>
        <div className="flex flex-wrap gap-2 justify-center">
          <a href={MAPS_LINK} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 text-sm" style={{ background: '#ece8df', color: '#0b0b0c' }}>افتح في خرائط جوجل</a>
          <button type="button" onClick={() => setShow(true)} className="px-5 py-2.5 text-sm border" style={{ borderColor: 'rgba(236,232,223,.4)' }}>عرض الخريطة هنا</button>
        </div>
        <span className="text-[11px] opacity-60">عرض الخريطة يحمّل بلاطات من OpenStreetMap وقد يشارك عنوان IP الخاص بك معها</span>
      </div>
    );
  }
  return (
    <div style={{ height, position: 'relative' }} className="shop-map">
      <MapContainer center={[lat, lng]} zoom={zoom} style={{ height: '100%', width: '100%', background: '#17181b' }}
        scrollWheelZoom={false} zoomControl={false} dragging={true}>
        <TileLayer url={DARK_TILES} subdomains={TILE_SUBDOMAINS} maxZoom={19} attribution="© OpenStreetMap"
          eventHandlers={{
            tileload: () => { ok.current = true; },
            tileerror: () => { errs.current += 1; if (!ok.current && errs.current >= 3) setFailed(true); },
          }} />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
      {failed && (
        <a href={MAPS_LINK} target="_blank" rel="noopener noreferrer"
          className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-3 text-center"
          style={{ background: '#17181b', color: '#ece8df' }}>
          <span className="text-base font-semibold">الرياض، حي العزيزية، شارع الشباب</span>
          <span className="px-5 py-2.5 text-sm" style={{ background: '#ece8df', color: '#0b0b0c' }}>افتح الموقع في خرائط جوجل</span>
        </a>
      )}
    </div>
  );
}
