"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

export interface CheckInMapProps {
  venue: { lat: number; lng: number; radiusM: number; name: string };
  me: { lat: number; lng: number; accuracyM: number } | null;
}

const pin = L.divIcon({
  className: "",
  html: `<svg width="32" height="41" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 45 18 45s17-15 17-27.4C35 8.4 27.4 1 18 1z" fill="#d4a437" stroke="#0a1a44" stroke-width="2"/><circle cx="18" cy="17" r="6.5" fill="#0a1a44"/></svg>`,
  iconSize: [32, 41],
  iconAnchor: [16, 39],
});

function Fit({ venue, me }: CheckInMapProps) {
  const map = useMap();
  useEffect(() => {
    if (!me) {
      map.setView([venue.lat, venue.lng], 17);
      return;
    }
    map.fitBounds(L.latLngBounds([venue.lat, venue.lng], [me.lat, me.lng]).pad(0.35), { maxZoom: 18 });
  }, [map, venue.lat, venue.lng, me]);
  return null;
}

export default function CheckInMapInner({ venue, me }: CheckInMapProps) {
  return (
    <MapContainer
      center={[venue.lat, venue.lng]}
      zoom={17}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Circle
        center={[venue.lat, venue.lng]}
        radius={venue.radiusM}
        pathOptions={{ color: "#1e40af", weight: 2, fillColor: "#60a5fa", fillOpacity: 0.15 }}
      />
      <Marker position={[venue.lat, venue.lng]} icon={pin} title={venue.name} alt={`${venue.name} pin`} />
      {me && (
        <>
          <Circle
            center={[me.lat, me.lng]}
            radius={me.accuracyM}
            pathOptions={{ color: "#0d9488", weight: 1, fillColor: "#14b8a6", fillOpacity: 0.12, dashArray: "4 4" }}
          />
          <CircleMarker
            center={[me.lat, me.lng]}
            radius={8}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#0d9488", fillOpacity: 1 }}
          />
        </>
      )}
      <Fit venue={venue} me={me} />
    </MapContainer>
  );
}
