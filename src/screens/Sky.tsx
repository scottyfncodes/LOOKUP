import { useMemo } from 'react';
import { Sources } from '../components/Sources';
import { Tag } from '../components/Tag';
import { fromJD, toJD } from '../core/astro/julian';
import { nextPhase } from '../core/astro/moon';
import { fmtDay, fmtDuration, fmtTime, localDateOf } from '../core/time';
import { SHOWERS, SHOWER_SOURCE } from '../data/showers';
import { SWPC_SOURCE } from '../services/swpc';
import type { NightData } from '../store/useNightData';

function moonGlyph(phase: string): string {
  switch (phase) {
    case 'New Moon': return '🌑';
    case 'Waxing Crescent': return '🌒';
    case 'First Quarter': return '🌓';
    case 'Waxing Gibbous': return '🌔';
    case 'Full Moon': return '🌕';
    case 'Waning Gibbous': return '🌖';
    case 'Last Quarter': return '🌗';
    default: return '🌘';
  }
}

export function Sky({ data }: { data: NightData }) {
  const sel = data.selected;
  const tz = sel?.night.timezone ?? 'America/Denver';
  const night = sel?.night;

  const phases = useMemo(() => {
    if (!night) return null;
    const jd = toJD(new Date(night.span.start));
    const nn = fromJD(nextPhase(jd, 0)).getTime();
    const nf = fromJD(nextPhase(jd, 180)).getTime();
    return { newMoon: nn, fullMoon: nf };
  }, [night]);

  const upcoming = useMemo(() => {
    if (!night) return [];
    const y = night.date.year;
    const today = Date.UTC(y, night.date.month - 1, night.date.day);
    return SHOWERS.map((s) => {
      let peak = Date.UTC(y, s.peak.month - 1, s.peak.day);
      if (peak < today - 2 * 86400_000) peak = Date.UTC(y + 1, s.peak.month - 1, s.peak.day);
      return { s, peak, days: Math.round((peak - today) / 86400_000) };
    })
      .sort((a, b) => a.peak - b.peak)
      .slice(0, 4);
  }, [night]);

  if (!sel || !night) return <div className="nodata">Pick a site first.</div>;

  const vis = night.planets.filter((p) => p.window);
  const hidden = night.planets.filter((p) => !p.window);

  return (
    <>
      <h2 className="h2">What's up · {fmtDay(night.date)}</h2>
      <p className="dim" style={{ margin: '0 0 12px' }}>Over {sel.site.name}, from sunset to sunrise. All of it computed; none of it depends on the weather.</p>

      <div className="card">
        <div className="row between">
          <div>
            <div className="label" style={{ marginTop: 0 }}>Moon</div>
            <div className="display" style={{ fontSize: 30 }}>{night.moon.phase}</div>
            <div className="muted">{Math.round(night.moon.illumination * 100)}% illuminated</div>
          </div>
          <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>{moonGlyph(night.moon.phase)}</div>
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="stat"><b>{night.moon.upAtSunset ? 'up at sunset' : night.moon.rises[0] != null ? fmtTime(night.moon.rises[0], tz) : 'no rise'}</b><span>moonrise</span></div>
          <div className="stat"><b>{night.moon.sets[0] != null ? fmtTime(night.moon.sets[0], tz) : night.moon.upAtSunset || night.moon.rises.length ? 'after sunrise' : 'down all night'}</b><span>moonset</span></div>
          {phases && (
            <>
              <div className="stat"><b>{fmtDay(localDateOf(phases.newMoon, tz))}</b><span>next new moon</span></div>
              <div className="stat"><b>{fmtDay(localDateOf(phases.fullMoon, tz))}</b><span>next full moon</span></div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Darkness</div>
        <div className="grid2">
          <div className="stat"><b>{fmtTime(night.sun.sunset, tz)}</b><span>sunset</span></div>
          <div className="stat"><b>{fmtTime(night.sun.sunrise, tz)}</b><span>sunrise</span></div>
          <div className="stat"><b>{fmtTime(night.sun.astroDusk, tz)}</b><span>fully dark</span></div>
          <div className="stat"><b>{fmtTime(night.sun.astroDawn, tz)}</b><span>dark ends</span></div>
        </div>
        <div className="muted small" style={{ marginTop: 10 }}>
          {night.dark ? `${fmtDuration(night.darkMinutes)} of astronomical darkness, ${fmtDuration(night.moon.moonFreeDarkMinutes)} of it moon-free.` : 'The sky never gets astronomically dark tonight.'}
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Milky Way core</div>
        {night.galactic.window ? (
          <div>
            <b>Up in the {night.galactic.direction}</b> from {fmtTime(night.galactic.window.start, tz)} to {fmtTime(night.galactic.window.end, tz)}, peaking {Math.round(night.galactic.maxAlt)}° above the horizon.
            {night.galactic.maxAlt < 15 && <span className="muted"> Low: needs a clean southern horizon.</span>}
          </div>
        ) : (
          <div className="muted">Below the horizon during darkness. Core season at this latitude runs roughly March (pre-dawn) to October (early evening).</div>
        )}
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Planets</div>
        {vis.length === 0 && <div className="muted">No bright planet gets 10° up in darkness tonight.</div>}
        <div className="list">
          {vis.map((p) => (
            <div key={p.id} className="row between">
              <div>
                <b>{p.name}</b> <span className="muted">· look {p.direction}</span>
                <div className="dim">{fmtTime(p.window!.start, tz)} – {fmtTime(p.window!.end, tz)} · up to {Math.round(p.maxAlt)}°</div>
              </div>
              <Tag c="computed" />
            </div>
          ))}
        </div>
        {hidden.length > 0 && (
          <div className="dim" style={{ marginTop: 8 }}>
            Not tonight: {hidden.map((p) => `${p.name}${p.elongation < 15 ? ' (too near the Sun)' : ''}`).join(', ')}.
          </div>
        )}
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Meteor showers</div>
        {night.showers.length > 0 ? (
          <div className="list">
            {night.showers.map((s) => (
              <div key={s.shower.id}>
                <b>{s.shower.name}</b>{' '}
                <span className="muted">
                  {s.atPeak ? 'at peak' : s.daysFromPeak < 0 ? `peak in ${-s.daysFromPeak} days` : `peaked ${s.daysFromPeak} days ago`} · up to {s.shower.zhr}/h under ideal skies
                </span>
                <div className="dim">
                  Radiant {Math.round(s.radiantAltEarly)}° up early, {Math.round(s.radiantAltLate)}° before dawn.{s.shower.note ? ` ${s.shower.note}` : ''}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No annual shower is active tonight.</div>
        )}
        <div className="label">Coming up</div>
        <div className="list">
          {upcoming.map(({ s, peak, days }) => (
            <div key={s.id} className="row between">
              <div>
                <b>{s.name}</b> <span className="muted">· {fmtDay(localDateOf(peak, 'UTC'))}</span>
                <div className="dim">{days <= 0 ? 'tonight' : `in ${days} days`} · ZHR {s.zhr}</div>
              </div>
              <Tag c="official" />
            </div>
          ))}
        </div>
        <Sources list={[SHOWER_SOURCE]} />
      </div>

      <div className="card">
        <div className="label" style={{ marginTop: 0 }}>Aurora</div>
        {data.kp == null ? (
          <div className="muted">Space-weather forecast UNKNOWN (NOAA feed not reachable).</div>
        ) : data.kpMax == null ? (
          <div className="muted">No Kp forecast covers this night yet.</div>
        ) : (
          <div>
            <b>Kp up to {data.kpMax.toFixed(1)}</b> forecast during the night.{' '}
            <span className="muted">
              {data.kpMax >= 7 ? 'Aurora possible low in the north from Colorado. Rare; go look.' : data.kpMax >= 5 ? 'A minor storm; aurora unlikely this far south but the northern horizon is worth a glance.' : 'Quiet. Nothing to see from this latitude.'}
            </span>
          </div>
        )}
        <Sources list={[SWPC_SOURCE]} />
      </div>
    </>
  );
}
