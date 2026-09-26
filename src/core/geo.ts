import type { LatLon, Source } from './types';

const R_MI = 3958.7613;

export function haversineMiles(a: LatLon, b: LatLon): number {
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLon = (b.lon - a.lon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const DRIVE_ESTIMATE_SOURCE: Source = {
  label: 'Straight-line estimate (routing unavailable): 1.35× detour at 42 mph',
  confidence: 'estimate',
};

/** Fallback when the router is unreachable. Mountain roads are slow; this leans pessimistic on purpose. */
export function estimateDrive(a: LatLon, b: LatLon): { minutes: number; miles: number } {
  const miles = haversineMiles(a, b) * 1.35;
  return { minutes: (miles / 42) * 60, miles };
}
