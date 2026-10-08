// Distances on the Hyderabad map: how far a store is from you, and what
// "near you" means. Plain data and helpers only: no Firebase here.
import { HYDERABAD, type LatLng } from "./pins";

/** "Near you" means within this distance. */
export const NEAR_METRES = 2000;

/** Straight-line distance between two spots, in metres. */
export function metresBetween(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** "350 m", "1.2 km". */
export function formatDistance(metres: number) {
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** Whether a spot is on the part of the map we show. */
export function inHyderabad({ lat, lng }: LatLng) {
  const { south, west, north, east } = HYDERABAD.bounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
