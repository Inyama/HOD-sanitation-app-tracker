"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

export interface VenueMapProps {
  lat: number;
  lng: number;
  name: string;
  address: string;
  radiusM?: number;
  zoom?: number;
  className?: string;
}

/** Gold pin as an inline SVG icon (avoids Leaflet's default image paths, which break under bundlers). */
const pin = L.divIcon({
  className: "",
  html: `<svg width="36" height="46" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 45 18 45s17-15 17-27.4C35 8.4 27.4 1 18 1z" fill="#d4a437" stroke="#0a1a44" stroke-width="2"/><circle cx="18" cy="17" r="6.5" fill="#0a1a44"/></svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 44],
  popupAnchor: [0, -40],
});

export default function VenueMapInner({ lat, lng, name, address, radiusM, zoom = 16, className }: VenueMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className={className}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {radiusM && (
        <Circle
          center={[lat, lng]}
          radius={radiusM}
          pathOptions={{ color: "#1e40af", weight: 2, fillColor: "#60a5fa", fillOpacity: 0.15 }}
        />
      )}
      <Marker position={[lat, lng]} icon={pin} alt={`${name} pin`} title={name}>
        <Popup>
          <strong>{name}</strong>
          <br />
          {address}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
