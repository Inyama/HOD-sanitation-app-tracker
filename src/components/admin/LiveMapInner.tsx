"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";

export interface LiveDot {
  id: string;
  lat: number;
  lng: number;
  status: "ON_TIME" | "LATE";
  flagged: boolean;
  name: string;
}

export interface LiveMapProps {
  venue: { name: string; lat: number; lng: number; radiusM: number };
  dots: LiveDot[];
}

const pin = L.divIcon({
  className: "",
  html: `<svg width="32" height="41" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 45 18 45s17-15 17-27.4C35 8.4 27.4 1 18 1z" fill="#d4a437" stroke="#0a1a44" stroke-width="2"/><circle cx="18" cy="17" r="6.5" fill="#0a1a44"/></svg>`,
  iconSize: [32, 41],
  iconAnchor: [16, 39],
});

/** Check-in positions around the venue. Colour plus a ring for flags; names and status in tooltips. */
export default function LiveMapInner({ venue, dots }: LiveMapProps) {
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
        pathOptions={{ color: "#1e40af", weight: 2, fillColor: "#60a5fa", fillOpacity: 0.12 }}
      />
      <Marker position={[venue.lat, venue.lng]} icon={pin} alt={`${venue.name} pin`} />
      {dots.map((d) => (
        <CircleMarker
          key={d.id}
          center={[d.lat, d.lng]}
          radius={d.flagged ? 8 : 6}
          pathOptions={{
            color: d.flagged ? "#e11d48" : "#ffffff",
            weight: d.flagged ? 3 : 1.5,
            fillColor: d.status === "ON_TIME" ? "#16a34a" : "#f59e0b",
            fillOpacity: 0.9,
          }}
        >
          <Tooltip>
            {d.name}: {d.status === "ON_TIME" ? "On time" : "Late"}
            {d.flagged ? " (flagged)" : ""}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
