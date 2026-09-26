import { useState } from 'react';
import { PlaceSearch } from '../components/PlaceSearch';
import { Sources } from '../components/Sources';
import { SITES } from '../data/sites';
import { OPEN_METEO_SOURCE } from '../services/openMeteo';
import { OSRM_SOURCE } from '../services/osrm';
import { SWPC_SOURCE } from '../services/swpc';
import { GEOCODE_SOURCE } from '../services/geocode';
import { DEFAULT_PREFS, exportPrefs, importPrefs, setPrefs, usePrefs } from '../store/store';

const HOME_TIMES: Array<{ label: string; minutes: number | null }> = [
  { label: '11 PM', minutes: -60 },
  { label: 'Midnight', minutes: 0 },
  { label: '1 AM', minutes: 60 },
  { label: '1:30 AM', minutes: 90 },
  { label: '2 AM', minutes: 120 },
  { label: '3 AM', minutes: 180 },
  { label: 'No limit', minutes: null },
];

const DRIVES = [60, 90, 120, 150, 180, 240, 360];

export function More() {
  const prefs = usePrefs();
  const [editingHome, setEditingHome] = useState(!prefs.home);
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <>
      <h2 className="h2">Settings</h2>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Home</div>
        {prefs.home && !editingHome ? (
          <div className="row between">
            <div>
              <b>{prefs.home.name}</b>
              <div className="dim mono">{prefs.home.lat.toFixed(4)}, {prefs.home.lon.toFixed(4)}{prefs.home.timezone ? ` · ${prefs.home.timezone}` : ''}</div>
            </div>
            <button className="btn small" onClick={() => setEditingHome(true)}>Change</button>
          </div>
        ) : (
          <>
            <div className="help" style={{ marginTop: 0, marginBottom: 8 }}>Drive times, leave times and "Home sky" all hang off this. LOOKUP never guesses it.</div>
            <PlaceSearch
              onPick={(p) => {
                setPrefs({ home: { ...p, timezone: p.timezone ?? 'America/Denver' }, selectedSiteId: null });
                setEditingHome(false);
              }}
            />
            {prefs.home && <button className="btn small" style={{ marginTop: 8 }} onClick={() => setEditingHome(false)}>Cancel</button>}
          </>
        )}
        <div className="field">
          <label htmlFor="bortle">Light pollution at home (Bortle class)</label>
          <select id="bortle" className="input" value={prefs.homeBortle ?? ''} onChange={(e) => setPrefs({ homeBortle: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">Unknown</option>
            <option value="1">1 · Pristine</option>
            <option value="2">2 · Truly dark</option>
            <option value="3">3 · Rural</option>
            <option value="4">4 · Rural / suburban edge</option>
            <option value="5">5 · Suburban</option>
            <option value="6">6 · Bright suburban</option>
            <option value="7">7 · Suburban / urban</option>
            <option value="8">8 · City</option>
            <option value="9">9 · Inner city</option>
          </select>
          <div className="help">Read it off a light-pollution map and enter it; LOOKUP will not infer it. Most Front Range towns are 5–7.</div>
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Latest I'll be home</div>
        <div className="chips">
          {HOME_TIMES.map((h) => (
            <button key={h.label} className="chip" aria-pressed={prefs.latestHomeMinutes === h.minutes} onClick={() => setPrefs({ latestHomeMinutes: h.minutes })}>{h.label}</button>
          ))}
        </div>
        <div className="help">The window gets cut to make this; the drive never does.</div>
        <div className="label">Farthest I'll drive one way</div>
        <div className="chips">
          {DRIVES.map((m) => (
            <button key={m} className="chip" aria-pressed={prefs.maxDriveMinutes === m} onClick={() => setPrefs({ maxDriveMinutes: m })}>{m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60}`}</button>
          ))}
        </div>
        <div className="help">Sites past this still show, ranked last, so a great night far away is never hidden.</div>
      </div>

      <div className="card">
        <div className="toggle">
          <div>
            <b>Night-vision mode</b>
            <div className="dim">Red on black. Turn it on when you get out of the car; your eyes take 20 minutes to adapt and one white screen resets them.</div>
          </div>
          <button className="switch" role="switch" aria-checked={prefs.redMode} aria-label="Night-vision mode" onClick={() => setPrefs({ redMode: !prefs.redMode })} />
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Sites</div>
        <div className="help" style={{ marginTop: 0 }}>Hide the ones you will never drive to. Your own sites can be removed.</div>
        <div className="list" style={{ marginTop: 10 }}>
          {[...SITES, ...prefs.customSites].map((s) => {
            const hidden = prefs.hiddenSiteIds.includes(s.id);
            return (
              <div key={s.id} className="row between">
                <div style={{ opacity: hidden ? 0.5 : 1 }}>
                  <b>{s.name}</b> <span className="dim">· {s.region}</span>
                </div>
                <div className="btn-row">
                  {s.custom ? (
                    <button className="btn small" onClick={() => setPrefs((p) => ({ customSites: p.customSites.filter((c) => c.id !== s.id), selectedSiteId: p.selectedSiteId === s.id ? null : p.selectedSiteId }))}>Remove</button>
                  ) : (
                    <button className="btn small" onClick={() => setPrefs((p) => ({ hiddenSiteIds: hidden ? p.hiddenSiteIds.filter((h) => h !== s.id) : [...p.hiddenSiteIds, s.id] }))}>{hidden ? 'Show' : 'Hide'}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Your data</div>
        <div className="help" style={{ marginTop: 0 }}>Everything lives in this browser. No account, no server, no analytics. Export to move it to another device.</div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button
            className="btn small"
            onClick={async () => {
              const json = exportPrefs();
              try {
                await navigator.clipboard.writeText(json);
                setMsg('Copied to the clipboard.');
              } catch {
                setImportText(json);
                setMsg('Clipboard blocked; the JSON is in the box below.');
              }
            }}
          >
            Export
          </button>
          <button className="btn small" onClick={() => { if (confirm('Reset every setting and remove your sites?')) { setPrefs(DEFAULT_PREFS); setMsg('Reset.'); } }}>Reset</button>
        </div>
        <div className="field">
          <label htmlFor="imp">Import</label>
          <textarea id="imp" className="input" style={{ minHeight: 70, padding: 10 }} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste an export here" />
          <button className="btn small" onClick={() => setMsg(importPrefs(importText) ? 'Imported.' : 'That was not a LOOKUP export.')}>Import</button>
        </div>
        {msg && <div className="help">{msg}</div>}
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Sources</div>
        <Sources list={[OPEN_METEO_SOURCE, OSRM_SOURCE, SWPC_SOURCE, GEOCODE_SOURCE, ...SITES[0].sources]} />
        <footer className="about">
          Astronomy is computed on the phone from Meeus, <i>Astronomical Algorithms</i> (Sun, Moon, sidereal time) and JPL's approximate planetary elements. Every number
          in LOOKUP carries its provenance: <b>computed</b>, <b>forecast</b>, <b>official</b>, <b>estimate</b> or <b>you entered</b>. Where nothing defensible is known
          the value is UNKNOWN. Site coordinates are representative points, not instructions on where to stand; check access, hours and road conditions before you go.
        </footer>
      </div>
    </>
  );
}
