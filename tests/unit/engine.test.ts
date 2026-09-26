import { describe, expect, it } from 'vitest';
import { buildNight, moonInterference, tonightDate } from '../../src/core/engine/night';
import { bestWindow, lightPollutionFactor, scoreNight } from '../../src/core/engine/score';
import { buildTimeline } from '../../src/core/engine/plan';
import { darkCalendar, nextDarkWeekend } from '../../src/core/engine/calendar';
import type { HourForecast } from '../../src/core/forecast';
import { fmtTime, localParts, zonedToUtc, dateKey, addDays } from '../../src/core/time';

const TZ = 'America/Denver';
const DENVER = { lat: 39.7392, lon: -104.9903 };
const SAND_DUNES = { lat: 37.7325, lon: -105.512 };

function flatForecast(night: { span: { start: number; end: number } }, cloud: number, extra: Partial<HourForecast> = {}): HourForecast[] {
  const out: HourForecast[] = [];
  const start = Math.floor(night.span.start / 3600_000) * 3600_000 - 2 * 3600_000;
  for (let t = start; t <= night.span.end + 2 * 3600_000; t += 3600_000) {
    out.push({ t, cloud, cloudLow: cloud, cloudMid: 0, cloudHigh: 0, temp: 45, humidity: 40, dewpoint: 20, wind: 5, gust: 8, precipProb: 0, visibility: 20000, ...extra });
  }
  return out;
}

describe('time helpers', () => {
  it('round-trips a Denver wall-clock time across DST', () => {
    const summer = zonedToUtc(2026, 7, 4, 21, 0, TZ);
    expect(new Date(summer).toISOString()).toBe('2026-07-05T03:00:00.000Z');
    const winter = zonedToUtc(2026, 1, 4, 21, 0, TZ);
    expect(new Date(winter).toISOString()).toBe('2026-01-05T04:00:00.000Z');
    expect(localParts(summer, TZ).hour).toBe(21);
    expect(fmtTime(summer, TZ)).toBe('9:00 PM');
  });
  it('date keys and day arithmetic', () => {
    expect(dateKey({ year: 2026, month: 9, day: 26 })).toBe('2026-09-26');
    expect(dateKey(addDays({ year: 2026, month: 12, day: 31 }, 1))).toBe('2027-01-01');
  });
});

describe('night model', () => {
  const night = buildNight({ year: 2026, month: 9, day: 26 }, DENVER, TZ);
  it('spans sunset to sunrise with 15-minute samples', () => {
    expect(fmtTime(night.span.start, TZ)).toMatch(/6:5\d PM/);
    expect(fmtTime(night.span.end, TZ)).toMatch(/6:5\d AM/);
    expect(night.samples.length).toBeGreaterThan(44);
    expect(night.samples[1].t - night.samples[0].t).toBe(15 * 60_000);
    expect(night.hasForecast).toBe(false);
  });
  it('astronomical dark is inside the span and darkness is monotone at the edges', () => {
    expect(night.dark).not.toBeNull();
    expect(night.dark!.start).toBeGreaterThan(night.span.start);
    expect(night.dark!.end).toBeLessThan(night.span.end);
    expect(night.samples[0].dark).toBe(false);
    expect(night.samples[Math.floor(night.samples.length / 2)].dark).toBe(true);
    expect(night.darkMinutes).toBeGreaterThan(8 * 60);
  });
  it('moon-free dark never exceeds dark', () => {
    expect(night.moon.moonFreeDarkMinutes).toBeLessThanOrEqual(night.darkMinutes);
    expect(night.moon.illumination).toBeGreaterThanOrEqual(0);
    expect(night.moon.illumination).toBeLessThanOrEqual(1);
  });
  it('the Milky Way core is low and setting in the southwest by late September', () => {
    expect(night.galactic.maxAlt).toBeLessThan(25);
    if (night.galactic.window) expect(['S', 'SSW', 'SW', 'WSW']).toContain(night.galactic.direction);
  });
  it('lists the Taurids as active in late September and nothing else', () => {
    expect(night.showers.map((s) => s.shower.id)).toEqual(['sta']);
    expect(night.showers[0].atPeak).toBe(false);
  });
  it('planets each get a window only when ≥10° up in darkness', () => {
    for (const p of night.planets) {
      if (p.window) {
        expect(p.maxAlt).toBeGreaterThanOrEqual(10);
        expect(p.direction).not.toBeNull();
      }
    }
  });
  it('Geminids peak night flags the shower at peak with the radiant high before dawn', () => {
    const n = buildNight({ year: 2026, month: 12, day: 13 }, DENVER, TZ);
    const gem = n.showers.find((s) => s.shower.id === 'gem');
    expect(gem).toBeDefined();
    expect(gem!.atPeak).toBe(true);
    expect(gem!.radiantAltLate).toBeGreaterThan(40);
  });
  it('moon interference is zero for a set moon and near one for a full moon high up', () => {
    expect(moonInterference(1, -10)).toBe(0);
    expect(moonInterference(1, 40)).toBeCloseTo(1, 5);
    expect(moonInterference(0.1, 40)).toBeLessThan(0.05);
  });
  it('tonight is yesterday\'s night before sunrise and today\'s after', () => {
    const threeAm = zonedToUtc(2026, 9, 27, 3, 0, TZ);
    expect(dateKey(tonightDate(threeAm, DENVER, TZ))).toBe('2026-09-26');
    const tenAm = zonedToUtc(2026, 9, 27, 10, 0, TZ);
    expect(dateKey(tonightDate(tenAm, DENVER, TZ))).toBe('2026-09-27');
  });
});

describe('scoring', () => {
  const date = { year: 2026, month: 10, day: 10 }; // around the October 2026 new moon
  const night = buildNight(date, SAND_DUNES, TZ);
  it('the October 2026 new-moon night at the Dunes is moon-free', () => {
    expect(night.moon.illumination).toBeLessThan(0.05);
    expect(night.moon.moonFreeDarkMinutes).toBeGreaterThan(night.darkMinutes - 30);
  });
  it('without a forecast the tier is unknown but an if-clear number is given', () => {
    const s = scoreNight({ night, bortle: { min: 1, max: 3 } });
    expect(s.tier).toBe('unknown');
    expect(s.value).toBeNull();
    expect(s.ifClear).toBeGreaterThan(8.5);
    expect(s.reasons[0].confidence).toBe('forecast');
    expect(s.window).not.toBeNull();
  });
  it('a clear new-moon night at a dark site is a GO', () => {
    const fc = flatForecast(night, 5);
    const n = buildNight(date, SAND_DUNES, TZ, { forecast: fc });
    const s = scoreNight({ night: n, bortle: { min: 1, max: 3 }, forecast: fc });
    expect(s.tier).toBe('go');
    expect(s.value!).toBeGreaterThan(8);
    expect(s.window!.moonFree).toBe(true);
    expect(s.reasons.some((r) => r.effect === 'plus' && r.confidence === 'forecast')).toBe(true);
  });
  it('the same night overcast is a STAY IN', () => {
    const fc = flatForecast(night, 95);
    const n = buildNight(date, SAND_DUNES, TZ, { forecast: fc });
    const s = scoreNight({ night: n, bortle: { min: 1, max: 3 }, forecast: fc });
    expect(s.tier).toBe('skip');
    expect(s.value!).toBeLessThan(2);
  });
  it('a full moon caps a clear night well below GO', () => {
    const fullDate = { year: 2026, month: 10, day: 26 };
    const base = buildNight(fullDate, SAND_DUNES, TZ);
    expect(base.moon.illumination).toBeGreaterThan(0.95);
    const fc = flatForecast(base, 0);
    const n = buildNight(fullDate, SAND_DUNES, TZ, { forecast: fc });
    const s = scoreNight({ night: n, bortle: { min: 1, max: 3 }, forecast: fc });
    expect(s.value!).toBeLessThan(5);
    expect(s.reasons.some((r) => /Moon|Gibbous|Quarter|Crescent/.test(r.text) && r.effect === 'minus')).toBe(true);
  });
  it('wind, cold and precipitation each cost points with forecast-labelled reasons', () => {
    const fc = flatForecast(night, 5, { wind: 30, temp: 5, precipProb: 60 });
    const n = buildNight(date, SAND_DUNES, TZ, { forecast: fc });
    const calm = scoreNight({ night: buildNight(date, SAND_DUNES, TZ, { forecast: flatForecast(night, 5) }), bortle: 2, forecast: flatForecast(night, 5) });
    const rough = scoreNight({ night: n, bortle: 2, forecast: fc });
    expect(rough.value!).toBeLessThan(calm.value! - 2.5);
    expect(rough.reasons.filter((r) => r.confidence === 'forecast' && r.effect === 'minus').length).toBeGreaterThanOrEqual(3);
  });
  it('light pollution unknown is scored as moderately dark and says so', () => {
    expect(lightPollutionFactor(null)).toEqual({ factor: 0.85, known: false });
    expect(lightPollutionFactor(1).factor).toBe(1);
    expect(lightPollutionFactor({ min: 8, max: 9 }).factor).toBeLessThan(0.25);
    const s = scoreNight({ night, bortle: null });
    expect(s.reasons.some((r) => /UNKNOWN/.test(r.text))).toBe(true);
  });
  it('best window respects the latest-at-site constraint', () => {
    const latest = zonedToUtc(2026, 10, 10, 23, 0, TZ);
    const w = bestWindow(night.samples, false, null, latest);
    expect(w).not.toBeNull();
    expect(w!.end).toBeLessThanOrEqual(latest);
  });
  it('a broken sky picks the clearer stretch', () => {
    const fc = flatForecast(night, 90).map((h) => {
      const hr = localParts(h.t, TZ).hour;
      return hr >= 22 || hr < 2 ? { ...h, cloud: 5, cloudLow: 5 } : h;
    });
    const n = buildNight(date, SAND_DUNES, TZ, { forecast: fc });
    const s = scoreNight({ night: n, bortle: 2, forecast: fc });
    const startHr = localParts(s.window!.start, TZ).hour;
    expect([21, 22, 23]).toContain(startHr);
    expect(s.window!.meanCloud!).toBeLessThan(30);
  });
});

describe('timeline', () => {
  const win = { start: zonedToUtc(2026, 10, 10, 21, 0, TZ), end: zonedToUtc(2026, 10, 11, 1, 0, TZ), meanQuality: 0.9, meanCloud: 5, moonFree: true };
  const drive = { minutes: 120, miles: 110, source: { label: 't', confidence: 'estimate' as const } };
  it('leaves early enough to arrive 25 minutes before the window', () => {
    const t = buildTimeline(win, drive, null)!;
    expect(fmtTime(t.leaveHome, TZ)).toBe('6:35 PM');
    expect(fmtTime(t.arrive, TZ)).toBe('8:35 PM');
    expect(fmtTime(t.home, TZ)).toBe('3:00 AM');
    expect(t.clipped).toBe(false);
  });
  it('clips the window, not the drive, to make a latest-home time', () => {
    const t = buildTimeline(win, drive, zonedToUtc(2026, 10, 11, 1, 0, TZ))!;
    expect(fmtTime(t.leaveSite, TZ)).toBe('11:00 PM');
    expect(t.clipped).toBe(true);
  });
  it('gives up when the clipped window is under 45 minutes', () => {
    expect(buildTimeline(win, drive, zonedToUtc(2026, 10, 10, 23, 30, TZ))).toBeNull();
  });
});

describe('calendar', () => {
  it('finds a moon-free weekend near the new moon and none near the full moon', () => {
    const cal = darkCalendar({ year: 2026, month: 10, day: 1 }, 30, DENVER, TZ);
    expect(cal.length).toBe(30);
    const best = nextDarkWeekend(cal)!;
    expect(best).not.toBeNull();
    expect(best.weekend).toBe(true);
    expect(best.night.date.day).toBeGreaterThanOrEqual(2);
    expect(best.night.date.day).toBeLessThanOrEqual(17);
    // Around Oct 26 (full) the share of moon-free dark collapses.
    const full = cal.find((c) => c.night.date.day === 26)!;
    expect(full.share).toBeLessThan(0.15);
  });
});
