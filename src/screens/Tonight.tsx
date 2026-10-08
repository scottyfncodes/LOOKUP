import { NightStrip } from '../components/NightStrip';
import { Reasons } from '../components/Reasons';
import { ScoreNum } from '../components/ScoreNum';
import { Sources } from '../components/Sources';
import { Tag } from '../components/Tag';
import { verdict } from '../core/engine/score';
import { addDays, dateKey, fmtDay, fmtDuration, fmtTime } from '../core/time';
import { measureText } from '../core/types';
import { OPEN_METEO_SOURCE } from '../services/openMeteo';
import { setPrefs, usePrefs } from '../store/store';
import { HOME_ID, type NightData } from '../store/useNightData';

export function Tonight({ data, go }: { data: NightData; go: (tab: 'sites' | 'more') => void }) {
  const prefs = usePrefs();
  const sel = data.selected;
  const tz = sel?.night.timezone ?? 'America/Denver';
  const tomorrow = addDays(data.tonight, 1);
  const tl = sel?.timeline ?? null;
  const status = !tl || !sel || !data.isTonight ? null
    : data.now >= tl.windowEnd ? { text: 'That window has passed. Check Tomorrow.', live: false }
    : data.now >= tl.windowStart ? { text: 'You are in the window now.', live: true }
    : data.now >= tl.leaveHome && sel.site.id !== HOME_ID ? { text: 'Leave now to catch the start of the window.', live: true }
    : null;

  const noDrive = !!sel && sel.site.id !== HOME_ID && !sel.drive;
  const nightWord = data.isTonight ? 'Tonight' : dateKey(data.date) === dateKey(tomorrow) ? 'Tomorrow night' : fmtDay(data.date, 'long');
  const call = sel ? verdict(sel.score) : null;
  // Setup and data warnings: one line, ranked below the answer.
  const hints: Array<{ key: string; text: string; action?: { label: string; go: 'more' } }> = [];
  if (!prefs.home) hints.push({ key: 'home', text: 'for drive times', action: { label: 'Set home', go: 'more' } });
  if (data.forecastError) hints.push({ key: 'fc', text: 'Forecast offline' });
  else if (data.loading && sel && !sel.night.hasForecast) hints.push({ key: 'loading', text: 'Fetching the cloud forecast…' });

  return (
    <>
      {sel && call && (
        <>
          <div className="card hero">
            <div className="verdict">
              <div className="eyebrow">
                {nightWord} · {fmtDay(data.date, data.isTonight ? 'long' : 'short')}
              </div>
              <h1 className={`display tier t-${call.tier}`}>{call.label}</h1>
              <div className="headline">{sel.score.headline}</div>
              <div className="where">
                <ScoreNum s={sel.score} />
                <button className="sitebtn" onClick={() => go('sites')} aria-label="Change site">
                  <span className="display site">{sel.site.id === HOME_ID ? 'Home sky' : sel.site.name}{'\u00a0'}<span className="caret">▾</span></span>
                  <span className="region">
                    {sel.site.region}
                    {sel.site.designation !== 'none' && <span className="badge">{sel.site.designation}</span>}
                  </span>
                </button>
              </div>
            </div>

            {sel.timeline ? (
              <div className="timeline">
                <div className="k">Window</div>
                <div className="v">
                  {fmtTime(sel.timeline.windowStart, tz)} – {fmtTime(sel.timeline.windowEnd, tz)}
                  <em>
                    {fmtDuration((sel.timeline.windowEnd - sel.timeline.windowStart) / 60_000)}
                    {sel.score.window?.moonFree ? ' · moon-free' : ''}
                    {sel.timeline.clipped ? ' · cut to make your home time' : ''}
                  </em>
                </div>
                {sel.site.id !== HOME_ID && !noDrive && (
                  <>
                    <div className="k">Leave</div>
                    <div className="v">
                      {fmtTime(sel.timeline.leaveHome, tz)}
                      <em>
                        {sel.drive ? `${fmtDuration(sel.drive.minutes)} drive${sel.drive.miles != null ? ` · ${Math.round(sel.drive.miles)} mi` : ''}` : ''}
                      </em>
                    </div>
                  </>
                )}
                {sel.site.id !== HOME_ID && (
                  <>
                    <div className="k">Arrive</div>
                    <div className="v">
                      {fmtTime(sel.timeline.arrive, tz)}<em>eyes adapt while it gets dark</em>
                    </div>
                  </>
                )}
                {sel.site.id !== HOME_ID && !noDrive && (
                  <>
                    <div className="k">Home</div>
                    <div className="v">{fmtTime(sel.timeline.home, tz)}</div>
                  </>
                )}
              </div>
            ) : sel.score.window ? (
              <div className="timeline">
                <div className="k">Window</div>
                <div className="v">
                  {fmtTime(sel.score.window.start, tz)} – {fmtTime(sel.score.window.end, tz)}
                  <em>too far to fit inside your home time</em>
                </div>
              </div>
            ) : null}

            {status && <div className={`status ${status.live ? 'live' : ''}`}>{status.text}</div>}
            <NightStrip night={sel.night} window={sel.score.window} now={data.now} />
            <div className="legend">
              <span><i style={{ background: 'var(--moon)' }} />Moon ({Math.round(sel.night.moon.illumination * 100)}%)</span>
              <span><i style={{ background: 'var(--mw)' }} />Milky Way core</span>
              {sel.night.hasForecast && <span><i style={{ background: 'var(--cloud)' }} />Cloud cover</span>}
              <span><i style={{ background: 'var(--accent)', opacity: 0.5 }} />Twilight</span>
            </div>
          </div>

          {hints.length > 0 && (
            <div className="hints" role="status">
              {hints.map((h, i) => (
                <span key={h.key} className="hint">
                  {i > 0 && <span className="sep" aria-hidden>·</span>}
                  {h.key === 'loading' && <span className="spinner" aria-hidden />}
                  {h.action && <button className="linkbtn" onClick={() => go(h.action!.go)}>{h.action.label}</button>}
                  {h.text}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <div className="chips scroll" role="tablist" aria-label="Which night" style={{ marginTop: 12 }}>
        <button className="chip" aria-pressed={data.isTonight} onClick={() => setPrefs({ selectedDate: null })}>Tonight</button>
        <button className="chip" aria-pressed={dateKey(data.date) === dateKey(tomorrow)} onClick={() => setPrefs({ selectedDate: dateKey(tomorrow) })}>
          Tomorrow
        </button>
        <label className="chip">
          <input type="date" value={dateKey(data.date)} onChange={(e) => setPrefs({ selectedDate: e.target.value || null })} aria-label="Pick a night" />
        </label>
        {!sel && (
          <button className="chip" onClick={() => go('sites')}>Pick a site ▾</button>
        )}
      </div>

      {!sel && !prefs.home && (
        <div className="notice" style={{ marginTop: 12 }}>
          No home set, so no drive times or leave times yet. <button className="btn small" onClick={() => go('more')}>Set home</button>
        </div>
      )}

      {sel && (
        <>
          <div className="card">
            <div className="label" style={{ marginTop: 0 }}>Why</div>
            <Reasons reasons={sel.score.reasons} />
          </div>

          <div className="card">
            <div className="label" style={{ marginTop: 0 }}>Conditions at the window midpoint</div>
            {sel.night.hasForecast ? (
              <div className="grid4">
                <div className="stat"><b>{sel.score.window?.meanCloud != null ? `${Math.round(sel.score.window.meanCloud)}%` : '—'}</b><span>cloud</span></div>
                <div className="stat"><b>{sel.score.comfort.temp != null ? `${Math.round(sel.score.comfort.temp)}°` : '—'}</b><span>temp</span></div>
                <div className="stat"><b>{sel.score.comfort.wind != null ? Math.round(sel.score.comfort.wind) : '—'}</b><span>wind mph</span></div>
                <div className="stat"><b>{sel.score.comfort.humidity != null ? `${Math.round(sel.score.comfort.humidity)}%` : '—'}</b><span>humidity</span></div>
              </div>
            ) : (
              <div className="nodata">No forecast for this night{data.loading ? ' yet' : ''}. Forecasts run about ten days out.</div>
            )}
            <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
              <Tag c="forecast" />
              <span className="dim">
                {sel.forecast ? `Open-Meteo · grid elevation ${sel.forecast.elevationM != null ? `${Math.round(sel.forecast.elevationM)} m` : 'unknown'} · fetched ${fmtTime(sel.forecast.fetchedAt, tz)}` : 'not fetched'}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="label" style={{ marginTop: 0 }}>The site</div>
            <div className="grid3">
              <div className="stat"><b>{measureText(sel.site.bortle)}</b><span>Bortle</span></div>
              <div className="stat"><b>{measureText(sel.site.elevationM ?? null, ' m')}</b><span>elevation</span></div>
              <div className="stat"><b>{sel.site.certifiedYear ?? '—'}</b><span>certified</span></div>
            </div>
            {sel.site.notes.length > 0 && (
              <ul className="muted small" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                {sel.site.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
            <a className="btn small" style={{ marginTop: 12 }} href={`https://www.google.com/maps/dir/?api=1&destination=${sel.site.lat},${sel.site.lon}`} target="_blank" rel="noreferrer">
              Directions ↗
            </a>
            <Sources list={[...sel.site.sources, ...(sel.drive ? [sel.drive.source] : []), OPEN_METEO_SOURCE]} />
          </div>
        </>
      )}
    </>
  );
}
