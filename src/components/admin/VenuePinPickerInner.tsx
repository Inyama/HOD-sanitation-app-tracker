"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import * as React from "react";

export interface VenuePinPickerProps {
  lat: number;
  lng: number;
  radiusM: number;
  name: string;
  onMove: (lat: number, lng: number) => void;
}

const pin = L.divIcon({
  className: "",
  html: `<svg width="36" height="46" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 45 18 45s17-15 17-27.4C35 8.4 27.4 1 18 1z" fill="#d4a437" stroke="#0a1a44" stroke-width="2"/><circle cx="18" cy="17" r="6.5" fill="#0a1a44"/></svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 44],
});

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMove(round(e.latlng.lat), round(e.latlng.lng)) });
  return null;
}

/** Keep the map centred when the coordinates are typed in. */
function Follow({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (!map.getBounds().contains([lat, lng])) map.panTo([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

export default function VenuePinPickerInner({ lat, lng, radiusM, name, onMove }: VenuePinPickerProps) {
  return (
    <MapContainer center={[lat, lng]} zoom={17} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Circle
        center={[lat, lng]}
        radius={radiusM}
        pathOptions={{ color: "#1e40af", weight: 2, fillColor: "#60a5fa", fillOpacity: 0.15 }}
      />
      <Marker
        position={[lat, lng]}
        icon={pin}
        draggable
        alt={`${name} pin`}
        title="Drag to move the venue pin"
        eventHandlers={{
          dragend: (e) => {
            const p = (e.target as L.Marker).getLatLng();
            onMove(round(p.lat), round(p.lng));
          },
        }}
      />
      <ClickToMove onMove={onMove} />
      <Follow lat={lat} lng={lng} />
    </MapContainer>
  );
}
