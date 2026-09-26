import type { Source } from './types';

/** One forecast hour. Every field may be null: the model did not say, so neither do we. */
export interface HourForecast {
  /** Start of the hour, epoch ms. */
  t: number;
  cloud: number | null;
  cloudLow: number | null;
  cloudMid: number | null;
  cloudHigh: number | null;
  /** °F */
  temp: number | null;
  /** % */
  humidity: number | null;
  /** °F */
  dewpoint: number | null;
  /** mph */
  wind: number | null;
  gust: number | null;
  /** % */
  precipProb: number | null;
  /** metres, as reported */
  visibility: number | null;
}

export interface PointForecast {
  hours: HourForecast[];
  /** Model grid elevation in metres, if reported. */
  elevationM: number | null;
  timezone: string | null;
  fetchedAt: number;
  source: Source;
}

/** Linear interpolation of a per-hour field at an arbitrary instant. Null when either neighbour is missing. */
export function interpolate(hours: HourForecast[], field: keyof Omit<HourForecast, 't'>, ms: number): number | null {
  if (hours.length === 0) return null;
  if (ms < hours[0].t - 3600_000 || ms > hours[hours.length - 1].t + 3600_000) return null;
  let i = 0;
  while (i < hours.length - 1 && hours[i + 1].t <= ms) i++;
  const a = hours[i], b = hours[Math.min(i + 1, hours.length - 1)];
  const va = a[field], vb = b[field];
  if (va == null) return vb;
  if (vb == null || b.t === a.t) return va;
  const f = Math.max(0, Math.min(1, (ms - a.t) / (b.t - a.t)));
  return va + (vb - va) * f;
}
