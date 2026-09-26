import { DRIVE_ESTIMATE_SOURCE, estimateDrive } from '../core/geo';
import type { DriveInfo } from '../core/engine/plan';
import type { LatLon, Source } from '../core/types';
import { cacheGet, cacheSet, fetchJson } from './fetch';

/**
 * Drive times from the OSRM public demo server (OpenStreetMap roads, no live
 * traffic, no key). One table request for every site. Falls back to a
 * straight-line estimate that says so.
 */
export const OSRM_SOURCE: Source = {
  label: 'OSRM routing on OpenStreetMap roads (no live traffic, no seasonal closures)',
  url: 'https://project-osrm.org/',
  confidence: 'estimate',
};

export function buildTableUrl(home: LatLon, dests: LatLon[]): string {
  const coords = [home, ...dests].map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  return `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration,distance`;
}

export function parseTable(raw: unknown, count: number): Array<{ minutes: number; miles: number | null } | null> {
  const o = raw as { code?: string; durations?: unknown; distances?: unknown };
  if (o?.code !== 'Ok' || !Array.isArray(o.durations) || !Array.isArray(o.durations[0])) throw new Error('Bad routing response');
  const dur = o.durations[0] as unknown[];
  const dist = (Array.isArray(o.distances) && Array.isArray(o.distances[0]) ? o.distances[0] : []) as unknown[];
  const out: Array<{ minutes: number; miles: number | null } | null> = [];
  for (let i = 1; i <= count; i++) {
    const s = dur[i], m = dist[i];
    out.push(typeof s === 'number' && Number.isFinite(s) && s >= 0 ? { minutes: s / 60, miles: typeof m === 'number' ? m / 1609.34 : null } : null);
  }
  return out;
}

export async function fetchDriveTimes(home: LatLon, dests: Array<LatLon & { id: string }>): Promise<Record<string, DriveInfo>> {
  const key = `drive:${home.lat.toFixed(3)},${home.lon.toFixed(3)}:${dests.map((d) => d.id).join(',')}`;
  const cached = cacheGet<Array<{ minutes: number; miles: number | null } | null>>(key, 7 * 24 * 3600_000);
  let routed: Array<{ minutes: number; miles: number | null } | null> = [];
  if (cached) routed = cached.value;
  else {
    try {
      routed = parseTable(await fetchJson(buildTableUrl(home, dests), 12_000), dests.length);
      cacheSet(key, routed);
    } catch {
      routed = [];
    }
  }
  const out: Record<string, DriveInfo> = {};
  dests.forEach((d, i) => {
    const r = routed[i];
    if (r) out[d.id] = { minutes: r.minutes, miles: r.miles, source: OSRM_SOURCE };
    else {
      const e = estimateDrive(home, d);
      out[d.id] = { minutes: e.minutes, miles: e.miles, source: DRIVE_ESTIMATE_SOURCE };
    }
  });
  return out;
}
