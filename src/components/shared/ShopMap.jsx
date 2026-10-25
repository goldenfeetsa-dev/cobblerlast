import React from 'react';
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

export const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export default function ShopMap({ lat, lng, zoom = 16, height = 320 }) {
  return (
    <div style={{ height }} className="shop-map">
      <MapContainer center={[lat, lng]} zoom={zoom} style={{ height: '100%', width: '100%', background: '#0b0b0c' }}
        scrollWheelZoom={false} zoomControl={false} dragging={true}>
        <TileLayer url={DARK_TILES} subdomains="abcd" maxZoom={19} attribution="© OpenStreetMap · © CARTO" />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}
