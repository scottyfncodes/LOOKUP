import type { HourForecast, PointForecast } from '../core/forecast';
import type { LatLon, Source } from '../core/types';
import { bounded, cacheGet, cacheSet, fetchJson, num } from './fetch';

/**
 * Open-Meteo (https://open-meteo.com): keyless, CORS-enabled, free for
 * non-commercial use. One request covers every site. Times are requested as
 * unix seconds so no wall-clock string is ever parsed.
 */
export const OPEN_METEO_SOURCE: Source = {
  label: 'Open-Meteo forecast (blend of national models incl. NOAA GFS/HRRR)',
  url: 'https://open-meteo.com/',
  confidence: 'forecast',
};

const HOURLY = 'cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability,visibility';

export function buildForecastUrl(points: LatLon[], days = 10): string {
  const p = new URLSearchParams({
    latitude: points.map((x) => x.lat.toFixed(4)).join(','),
    longitude: points.map((x) => x.lon.toFixed(4)).join(','),
    hourly: HOURLY,
    timezone: 'auto',
    timeformat: 'unixtime',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    forecast_days: String(Math.max(1, Math.min(16, days))),
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

type Json = Record<string, unknown>;
const arr = (o: unknown, k: string): unknown[] => {
  const v = (o as Json | undefined)?.[k];
  return Array.isArray(v) ? v : [];
};

/** Parse one location's payload. Throws if structurally unusable; individual bad values become null. */
export function parsePointForecast(raw: unknown, fetchedAt = Date.now()): PointForecast {
  if (!raw || typeof raw !== 'object') throw new Error('Empty forecast payload');
  const o = raw as Json;
  const hourly = o.hourly as Json | undefined;
  const times = arr(hourly, 'time');
  if (!hourly || times.length === 0) throw new Error('Forecast payload missing hourly data');
  const cc = arr(hourly, 'cloud_cover'), cl = arr(hourly, 'cloud_cover_low'), cm = arr(hourly, 'cloud_cover_mid'), ch = arr(hourly, 'cloud_cover_high');
  const te = arr(hourly, 'temperature_2m'), rh = arr(hourly, 'relative_humidity_2m'), dp = arr(hourly, 'dew_point_2m');
  const ws = arr(hourly, 'wind_speed_10m'), wg = arr(hourly, 'wind_gusts_10m'), pp = arr(hourly, 'precipitation_probability'), vi = arr(hourly, 'visibility');
  const hours: HourForecast[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = num(times[i]);
    if (t == null) continue;
    hours.push({
      t: t * 1000,
      cloud: bounded(cc[i], 0, 100), cloudLow: bounded(cl[i], 0, 100), cloudMid: bounded(cm[i], 0, 100), cloudHigh: bounded(ch[i], 0, 100),
      temp: bounded(te[i], -100, 140), humidity: bounded(rh[i], 0, 100), dewpoint: bounded(dp[i], -100, 140),
      wind: bounded(ws[i], 0, 200), gust: bounded(wg[i], 0, 250), precipProb: bounded(pp[i], 0, 100), visibility: bounded(vi[i], 0, 1e6),
    });
  }
  return { hours, elevationM: num(o.elevation), timezone: typeof o.timezone === 'string' ? o.timezone : null, fetchedAt, source: OPEN_METEO_SOURCE };
}

/** Fetch forecasts for many points at once. Returns null entries for points that failed. Cached 30 minutes. */
export async function fetchForecasts(points: Array<LatLon & { id: string }>, days = 10): Promise<Record<string, PointForecast | null>> {
  const out: Record<string, PointForecast | null> = {};
  if (points.length === 0) return out;
  const key = `om:${days}:${points.map((p) => `${p.id}@${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join('|')}`;
  const cached = cacheGet<Record<string, PointForecast | null>>(key, 30 * 60_000);
  if (cached) return cached.value;
  const raw = await fetchJson(buildForecastUrl(points, days), 15_000);
  const list = Array.isArray(raw) ? raw : [raw];
  const now = Date.now();
  points.forEach((p, i) => {
    try {
      out[p.id] = parsePointForecast(list[i], now);
    } catch {
      out[p.id] = null;
    }
  });
  cacheSet(key, out);
  return out;
}
