import { useState } from 'react';
import { PlaceSearch } from '../components/PlaceSearch';
import { scoreText } from '../components/ScoreNum';
import { fmtDay, fmtDuration } from '../core/time';
import { measureText } from '../core/types';
import type { Site } from '../data/sites';
import { setPrefs, usePrefs } from '../store/store';
import { HOME_ID, type NightData, type SiteNight } from '../store/useNightData';

function Row({ n, current, onPick }: { n: SiteNight; current: boolean; onPick: () => void }) {
  const t = scoreText(n.score);
  const w = n.score.window;
  return (
    <button className={`item ${n.tooFar ? 'faded' : ''}`} aria-current={current} onClick={onPick}>
      <div className={`num t-${n.score.tier}`}>
        {t.main}
        {t.sub && <small>{t.sub}</small>}
      </div>
      <div>
        <div className="name">
          {n.site.name}
          {n.site.designation !== 'none' && <span className="badge">{n.site.designation.replace('Dark Sky ', '')}</span>}
          {n.site.custom && <span className="badge">yours</span>}
        </div>
        <div className="sub">
          {n.site.region} · Bortle {measureText(n.site.bortle)}
          {w ? ` · ${w.moonFree ? 'moon-free' : 'moon up'}` : ''}
          {w?.meanCloud != null ? ` · ${Math.round(w.meanCloud)}% cloud` : ''}
        </div>
      </div>
      <div className="right">
        {n.site.id === HOME_ID ? 'here' : n.drive ? <>{fmtDuration(n.drive.minutes)}<br /><span className="dim">{n.tooFar ? 'past your limit' : n.drive.source.confidence === 'estimate' && /Straight/.test(n.drive.source.label) ? 'est.' : 'drive'}</span></> : <span className="dim">set home</span>}
      </div>
    </button>
  );
}

export function Sites({ data, onPicked }: { data: NightData; onPicked: () => void }) {
  const prefs = usePrefs();
  const [adding, setAdding] = useState(false);

  const addSite = (p: { name: string; lat: number; lon: number; elevationM?: number | { min: number; max: number } | null; timezone?: string }) => {
    const id = `custom-${Date.now().toString(36)}`;
    const site: Site = {
      id, name: p.name, region: 'Your site', lat: p.lat, lon: p.lon, elevationM: p.elevationM ?? null, timezone: p.timezone ?? 'America/Denver',
      designation: 'none', certifiedYear: null, bortle: null, notes: [], custom: true,
      sources: [{ label: 'You added this site; light pollution not entered', confidence: 'user' }],
    };
    setPrefs((s) => ({ customSites: [...s.customSites, site], selectedSiteId: id }));
    setAdding(false);
    onPicked();
  };

  return (
    <>
      <h2 className="h2">Where to go · {fmtDay(data.date)}</h2>
      <p className="dim" style={{ margin: '0 0 12px' }}>
        Ranked for this night: sky, clouds, light pollution and how far you said you'd drive. Tap one to plan around it.
      </p>
      {data.loading && <div className="help"><span className="spinner" />Fetching forecasts…</div>}
      <div className="list">
        {data.ranked.map((n) => (
          <Row
            key={n.site.id}
            n={n}
            current={data.selected?.site.id === n.site.id}
            onPick={() => {
              setPrefs({ selectedSiteId: n.site.id });
              onPicked();
            }}
          />
        ))}
      </div>
      <div className="row between" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => setPrefs({ selectedSiteId: null })}>Let LOOKUP pick</button>
        <button className="btn" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : '+ Add a site'}</button>
      </div>
      {adding && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="label" style={{ marginTop: 0 }}>Add your own site</div>
          <PlaceSearch onPick={addSite} placeholder="A town, a pass, or coordinates" />
          <div className="help">Light pollution for a site you add is UNKNOWN until you set a Bortle class in More.</div>
        </div>
      )}
      {prefs.hiddenSiteIds.length > 0 && (
        <button className="btn small" style={{ marginTop: 12 }} onClick={() => setPrefs({ hiddenSiteIds: [] })}>Show {prefs.hiddenSiteIds.length} hidden site{prefs.hiddenSiteIds.length > 1 ? 's' : ''}</button>
      )}
    </>
  );
}
