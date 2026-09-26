import { useEffect, useState } from 'react';
import type { Place } from '../core/types';
import { geocode, parseLatLon, type GeoResult } from '../services/geocode';

/**
 * Type a town or "lat, lon"; pick a result. There is no default and no
 * automatic GPS: "use my location" is a button the user presses.
 */
export function PlaceSearch({ onPick, placeholder = 'Town, or "39.74, -104.99"' }: { onPick: (p: Place) => void; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const direct = parseLatLon(q);
    if (direct) {
      setResults([{ name: `${direct.lat.toFixed(4)}, ${direct.lon.toFixed(4)}`, admin1: 'Coordinates', country: null, lat: direct.lat, lon: direct.lon, elevationM: null, timezone: null }]);
      setErr(null);
      return;
    }
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setBusy(true);
      setErr(null);
      geocode(q)
        .then((r) => setResults(r))
        .catch(() => setErr('Search is unavailable right now. Coordinates still work.'))
        .finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [q]);

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setErr('This browser has no location service.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onPick({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude, elevationM: pos.coords.altitude ?? null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      },
      () => {
        setBusy(false);
        setErr('Location was not shared. Type a town instead.');
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };

  return (
    <div>
      <div className="row">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoCapitalize="words" inputMode="search" aria-label="Search for a place" />
        <button className="btn" onClick={locate} type="button" aria-label="Use my location" title="Use my location">
          ◎
        </button>
      </div>
      {busy && <div className="help"><span className="spinner" />Searching…</div>}
      {err && <div className="help">{err}</div>}
      <div className="results">
        {results.map((r, i) => (
          <button key={i} className="btn" type="button" onClick={() => onPick({ name: r.admin1 && r.admin1 !== 'Coordinates' ? `${r.name}, ${r.admin1}` : r.name, lat: r.lat, lon: r.lon, elevationM: r.elevationM, timezone: r.timezone ?? undefined })}>
            <span style={{ flex: 1, textAlign: 'left' }}>
              {r.name}
              <span className="dim"> {r.admin1 ?? ''} {r.country ?? ''}</span>
            </span>
            <span className="dim mono">{r.lat.toFixed(2)}, {r.lon.toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
