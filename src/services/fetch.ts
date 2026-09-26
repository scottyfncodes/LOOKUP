/** Small fetch helpers. Every live call has a timeout and a labelled cache; nothing is ever served stale without saying so. */

export async function fetchJson(url: string, timeoutMs = 10_000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface CacheEntry<T> { at: number; value: T }

const PREFIX = 'lookup:cache:';

export function cacheGet<T>(key: string, maxAgeMs: number): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const e = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - e.at > maxAgeMs) return null;
    return e;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* quota or private mode: live without the cache */
  }
}

export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const bounded = (v: unknown, lo: number, hi: number): number | null => {
  const n = num(v);
  return n != null && n >= lo && n <= hi ? n : null;
};
