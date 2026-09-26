import type { Source } from '../core/types';
import { fetchJson, num } from './fetch';

export const GEOCODE_SOURCE: Source = {
  label: 'Open-Meteo geocoding (GeoNames)',
  url: 'https://open-meteo.com/en/docs/geocoding-api',
  confidence: 'official',
};

export interface GeoResult { name: string; admin1: string | null; country: string | null; lat: number; lon: number; elevationM: number | null; timezone: string | null }

export function parseGeocode(raw: unknown): GeoResult[] {
  const results = (raw as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((r) => {
    const o = r as Record<string, unknown>;
    const lat = num(o.latitude), lon = num(o.longitude);
    if (lat == null || lon == null || typeof o.name !== 'string') return [];
    return [{
      name: o.name, admin1: typeof o.admin1 === 'string' ? o.admin1 : null, country: typeof o.country_code === 'string' ? o.country_code : null,
      lat, lon, elevationM: num(o.elevation), timezone: typeof o.timezone === 'string' ? o.timezone : null,
    }];
  });
}

/** Coordinates typed directly ("39.74, -104.99") are honoured without a network call. */
export function parseLatLon(text: string): { lat: number; lon: number } | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export async function geocode(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
  return parseGeocode(await fetchJson(url, 8_000));
}
