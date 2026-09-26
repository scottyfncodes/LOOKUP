import { scoreText } from '../components/ScoreNum';
import { nextDarkWeekend } from '../core/engine/calendar';
import { TIER_LABEL } from '../core/engine/score';
import { dateKey, fmtDay, fmtDuration, fmtTime } from '../core/time';
import { setPrefs } from '../store/store';
import type { NightData } from '../store/useNightData';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function Week({ data, onPickNight }: { data: NightData; onPickNight: () => void }) {
  const sel = data.selected;
  const tz = sel?.night.timezone ?? 'America/Denver';
  const best = nextDarkWeekend(data.calendar);
  const lead = data.calendar[0]?.night.weekday ?? 0;

  return (
    <>
      <h2 className="h2">Later · {sel?.site.name ?? '—'}</h2>
      <p className="dim" style={{ margin: '0 0 12px' }}>
        Ten nights with a forecast, then the Moon alone. The further out, the less LOOKUP is willing to claim.
      </p>

      <div className="list">
        {data.week.map(({ date, night, score }) => {
          const t = scoreText(score);
          const w = score.window;
          return (
            <button
              key={dateKey(date)}
              className="item"
              aria-current={dateKey(date) === dateKey(data.date)}
              onClick={() => {
                setPrefs({ selectedDate: dateKey(date) });
                onPickNight();
              }}
            >
              <div className={`num t-${score.tier}`}>
                {t.main}
                {t.sub && <small>{t.sub}</small>}
              </div>
              <div>
                <div className="name">{fmtDay(date)}</div>
                <div className={`tierline t-${score.tier}`}>{TIER_LABEL[score.tier]}</div>
                <div className="sub">
                  {night.moon.phase} {Math.round(night.moon.illumination * 100)}% · {fmtDuration(night.moon.moonFreeDarkMinutes)} moon-free dark
                  {w?.meanCloud != null ? ` · ${Math.round(w.meanCloud)}% cloud` : ''}
                </div>
              </div>
              <div className="right">
                {w ? <>{fmtTime(w.start, tz)}<br /><span className="dim">to {fmtTime(w.end, tz)}</span></> : <span className="dim">no window</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="label">Moon-free dark, next 45 nights</div>
      {best ? (
        <div className="notice" style={{ marginBottom: 10 }}>
          Next dark weekend night: <b>{fmtDay(best.night.date, 'long')}</b>, {fmtDuration(best.moonFreeDarkMinutes)} without the Moon. Weather unknown that far out.
        </div>
      ) : (
        <div className="notice" style={{ marginBottom: 10 }}>No weekend night in the next 45 with four moon-free hours.</div>
      )}
      <div className="cal">
        {DOW.map((d, i) => <div key={i} className="dow">{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`pad${i}`} />)}
        {data.calendar.map((c) => {
          const pct = Math.round(c.share * 100);
          return (
            <button
              key={c.night.key}
              className={`cal-day day ${c.weekend ? 'weekend' : ''}`}
              aria-current={c.night.key === dateKey(data.date)}
              title={`${fmtDay(c.night.date, 'long')}: ${fmtDuration(c.moonFreeDarkMinutes)} moon-free dark, Moon ${Math.round(c.night.moon.illumination * 100)}%`}
              onClick={() => {
                setPrefs({ selectedDate: c.night.key });
                onPickNight();
              }}
            >
              <div className="fill" style={{ height: `${pct}%` }} />
              <span>{c.night.date.day}</span>
              <b>{Math.round(c.moonFreeDarkMinutes / 60)}h</b>
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span><i style={{ background: 'color-mix(in srgb, var(--mw) 35%, transparent)' }} />fill = share of the dark that is moon-free</span>
        <span><i style={{ border: '1px solid var(--accent)', background: 'transparent' }} />Fri / Sat</span>
      </div>
    </>
  );
}
