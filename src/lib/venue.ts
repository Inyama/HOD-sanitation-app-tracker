/** Venue helpers shared by server and client code. */

/** Google Maps directions to a point (opens the user's maps app on phones). */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
