import type { Source } from '../core/types';
import { cacheGet, cacheSet, fetchJson, num } from './fetch';

/**
 * NOAA Space Weather Prediction Center planetary K index forecast. Keyless.
 * At Colorado latitudes aurora needs roughly Kp 7 or more, so this only ever
 * adds to a night; it never subtracts. Failure → UNKNOWN, never a guess.
 */
export const SWPC_SOURCE: Source = {
  label: 'NOAA SWPC 3-day planetary K index forecast',
  url: 'https://www.swpc.noaa.gov/products/planetary-k-index',
  confidence: 'forecast',
};

export const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

export interface KpPoint { t: number; kp: number; kind: 'observed' | 'estimated' | 'predicted' }

/** Rows look like ["2026-09-26 00:00:00", "2.33", "observed", null]; the first row is a header. */
export function parseKp(raw: unknown): KpPoint[] {
  if (!Array.isArray(raw)) throw new Error('Bad Kp payload');
  const out: KpPoint[] = [];
  for (const row of raw.slice(1)) {
    if (!Array.isArray(row) || row.length < 3) continue;
    const t = Date.parse(String(row[0]).replace(' ', 'T') + 'Z');
    const kp = num(typeof row[1] === 'string' ? parseFloat(row[1]) : row[1]);
    const kind = String(row[2]) as KpPoint['kind'];
    if (!Number.isFinite(t) || kp == null) continue;
    out.push({ t, kp, kind });
  }
  return out;
}

export function maxKpBetween(points: KpPoint[], start: number, end: number): number | null {
  const inWin = points.filter((p) => p.t + 3 * 3600_000 > start && p.t < end);
  if (inWin.length === 0) return null;
  return Math.max(...inWin.map((p) => p.kp));
}

export async function fetchKp(): Promise<KpPoint[] | null> {
  const cached = cacheGet<KpPoint[]>('kp', 60 * 60_000);
  if (cached) return cached.value;
  try {
    const pts = parseKp(await fetchJson(KP_URL, 8_000));
    cacheSet('kp', pts);
    return pts;
  } catch {
    return null;
  }
}
