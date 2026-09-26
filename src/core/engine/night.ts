import { compass, toHorizontal } from '../astro/coords';
import { moonTimes, sunTimesForNight, type SunTimes } from '../astro/events';
import { galacticCenterAltAz } from '../astro/galactic';
import { DAY_MS, fromJD, toJD } from '../astro/julian';
import { moonAltAz, moonPosition, phaseName, type PhaseName } from '../astro/moon';
import { planetAltAz, planetPosition, PLANETS, PLANET_NAMES, type PlanetId } from '../astro/planets';
import { sunAltAz } from '../astro/sun';
import { interpolate, type HourForecast } from '../forecast';
import { addDays, dateKey, weekdayOf, zonedToUtc, type LocalDate } from '../time';
import type { LatLon, Measure } from '../types';
import { SHOWERS, type Shower } from '../../data/showers';

/**
 * The night model. One `Night` is everything LOOKUP knows about the sky over
 * one place from one sunset to the next sunrise, sampled every 15 minutes.
 * Astronomy is `computed`; anything from the forecast is `forecast`; the two
 * never share a field.
 */

export const STEP_MIN = 15;

export interface NightSample {
  /** epoch ms */
  t: number;
  sunAlt: number;
  moonAlt: number;
  /** 0–1: how much the Moon is spoiling the sky right now (illumination × altitude). */
  moonInterference: number;
  galacticAlt: number;
  /** Total cloud cover %, or null when there is no forecast for this instant. */
  cloud: number | null;
  /** Astronomical darkness (sun below −18°). */
  dark: boolean;
  /** Sky quality 0–1 given the Moon alone (clouds unknown). */
  skyQuality: number;
  /** Sky quality 0–1 given Moon and clouds; null when clouds are unknown. */
  quality: number | null;
}

export interface Window {
  start: number;
  end: number;
}

export interface MoonSummary {
  illumination: number;
  phase: PhaseName;
  /** Rise/set events within the night, epoch ms. */
  rises: number[];
  sets: number[];
  upAtSunset: boolean;
  /** Minutes of astronomical darkness with the Moon below the horizon. */
  moonFreeDarkMinutes: number;
}

export interface PlanetVisibility {
  id: PlanetId;
  name: string;
  /** Window during which it is ≥10° up and the sky is astronomically dark, if any. */
  window: Window | null;
  /** Best altitude reached in darkness. */
  maxAlt: number;
  /** Where to look at the middle of its window. */
  direction: string | null;
  /** Elongation from the Sun in degrees (tiny = lost in twilight). */
  elongation: number;
}

export interface ShowerVisibility {
  shower: Shower;
  /** Days from peak (negative = before). */
  daysFromPeak: number;
  atPeak: boolean;
  /** Radiant altitude at the end of the dark window, when rates are usually best. */
  radiantAltLate: number;
  radiantAltEarly: number;
}

export interface GalacticSummary {
  /** Window in darkness with the core ≥ 10° up, if any. */
  window: Window | null;
  maxAlt: number;
  direction: string | null;
}

export interface Night {
  date: LocalDate;
  key: string;
  weekday: number;
  place: LatLon;
  timezone: string;
  sun: Record<keyof SunTimes, number | null>;
  /** Sunset → sunrise, or a 12-hour fallback around local midnight when the sun never sets/rises. */
  span: Window;
  /** Astronomical dark, if it happens. */
  dark: Window | null;
  darkMinutes: number;
  moon: MoonSummary;
  samples: NightSample[];
  galactic: GalacticSummary;
  planets: PlanetVisibility[];
  showers: ShowerVisibility[];
  hasForecast: boolean;
}

/** Interference of the Moon on the sky: a thin crescent low down is nothing; a full moon overhead ends the night. */
export function moonInterference(illumination: number, alt: number): number {
  if (alt <= -3) return 0;
  const up = Math.min(1, (alt + 3) / 25);
  return Math.pow(Math.max(0, illumination), 1.5) * up;
}

export function localNoonMs(date: LocalDate, tz: string): number {
  return zonedToUtc(date.year, date.month, date.day, 12, 0, tz);
}

function windowsAbove(samples: NightSample[], altOf: (s: NightSample) => number, minAlt: number, requireDark: boolean): Window[] {
  const out: Window[] = [];
  let cur: Window | null = null;
  for (const s of samples) {
    const ok = altOf(s) >= minAlt && (!requireDark || s.dark);
    if (ok) {
      if (!cur) cur = { start: s.t, end: s.t + STEP_MIN * 60_000 };
      else cur.end = s.t + STEP_MIN * 60_000;
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function longest(ws: Window[]): Window | null {
  return ws.reduce<Window | null>((b, w) => (!b || w.end - w.start > b.end - b.start ? w : b), null);
}

function dayOfYear(d: LocalDate): number {
  return Math.round((Date.UTC(d.year, d.month - 1, d.day) - Date.UTC(d.year, 0, 0)) / DAY_MS);
}

function showerFor(shower: Shower, date: LocalDate): { active: boolean; daysFromPeak: number } {
  const doy = dayOfYear(date);
  const peakDoy = dayOfYear({ year: date.year, month: shower.peak.month, day: shower.peak.day });
  let d = doy - peakDoy;
  if (d > 182) d -= 365;
  if (d < -182) d += 365;
  const from = dayOfYear({ year: date.year, month: shower.active.from.month, day: shower.active.from.day });
  const to = dayOfYear({ year: date.year, month: shower.active.to.month, day: shower.active.to.day });
  const active = from <= to ? doy >= from && doy <= to : doy >= from || doy <= to;
  return { active, daysFromPeak: d };
}

export interface BuildNightOptions {
  forecast?: HourForecast[] | null;
}

export function buildNight(date: LocalDate, place: LatLon, tz: string, opts: BuildNightOptions = {}): Night {
  const noon = localNoonMs(date, tz);
  const jdNoon = toJD(new Date(noon));
  const sunT = sunTimesForNight(jdNoon, place.lat, place.lon);
  const sun = Object.fromEntries(
    Object.entries(sunT).map(([k, v]) => [k, v == null ? null : fromJD(v).getTime()]),
  ) as Record<keyof SunTimes, number | null>;

  // Span: sunset→sunrise; if the sun does not set (or rise) fall back to 18:00→06:00 local.
  const spanStart = sun.sunset ?? noon + 6 * 3600_000;
  const spanEnd = sun.sunrise ?? noon + 18 * 3600_000;
  const span: Window = { start: spanStart, end: spanEnd };
  const dark: Window | null = sun.astroDusk != null && sun.astroDawn != null ? { start: sun.astroDusk, end: sun.astroDawn } : null;
  const darkMinutes = dark ? (dark.end - dark.start) / 60_000 : 0;

  const forecast = opts.forecast ?? null;
  const samples: NightSample[] = [];
  const stepMs = STEP_MIN * 60_000;
  let moonFreeDark = 0;
  for (let t = span.start; t <= span.end; t += stepMs) {
    const jd = toJD(new Date(t));
    const s = sunAltAz(jd, place.lat, place.lon);
    const m = moonAltAz(jd, place.lat, place.lon);
    const mp = moonPosition(jd);
    const g = galacticCenterAltAz(jd, place.lat, place.lon);
    const isDark = s.alt <= -18;
    const interference = moonInterference(mp.illumination, m.alt);
    const skyQuality = isDark ? 1 - 0.9 * interference : 0;
    const cloud = forecast ? interpolate(forecast, 'cloud', t) : null;
    const quality = cloud == null ? null : skyQuality * (1 - cloud / 100);
    if (isDark && m.alt < 0) moonFreeDark += STEP_MIN;
    samples.push({ t, sunAlt: s.alt, moonAlt: m.alt, moonInterference: interference, galacticAlt: g.alt, cloud, dark: isDark, skyQuality, quality });
  }

  const midJd = toJD(new Date((span.start + span.end) / 2));
  const moonMid = moonPosition(midJd);
  const mt = moonTimes(toJD(new Date(span.start)), toJD(new Date(span.end)), place.lat, place.lon);
  const moon: MoonSummary = {
    illumination: moonMid.illumination,
    phase: phaseName(moonMid.phaseAngle),
    rises: mt.rises.map((j) => fromJD(j).getTime()),
    sets: mt.sets.map((j) => fromJD(j).getTime()),
    upAtSunset: mt.upAtStart,
    moonFreeDarkMinutes: moonFreeDark,
  };

  const gWin = longest(windowsAbove(samples, (s) => s.galacticAlt, 10, true));
  const gMax = samples.filter((s) => s.dark).reduce((m, s) => Math.max(m, s.galacticAlt), -90);
  const galactic: GalacticSummary = {
    window: gWin,
    maxAlt: gMax,
    direction: gWin ? compass(galacticCenterAltAz(toJD(new Date((gWin.start + gWin.end) / 2)), place.lat, place.lon).az) : null,
  };

  const planets: PlanetVisibility[] = PLANETS.map((id) => {
    const alts = samples.map((s) => ({ ...s, pAlt: planetAltAz(id, toJD(new Date(s.t)), place.lat, place.lon).alt }));
    const win = longest(windowsAbove(alts as unknown as NightSample[], (s) => (s as unknown as { pAlt: number }).pAlt, 10, true));
    const maxAlt = alts.filter((s) => s.dark).reduce((m, s) => Math.max(m, s.pAlt), -90);
    const elong = planetPosition(id, midJd).elongation;
    return {
      id,
      name: PLANET_NAMES[id],
      window: win,
      maxAlt,
      direction: win ? compass(planetAltAz(id, toJD(new Date((win.start + win.end) / 2)), place.lat, place.lon).az) : null,
      elongation: elong,
    };
  });

  const lateT = dark ? dark.end - 3600_000 : span.end - 3600_000;
  const earlyT = dark ? dark.start + 3600_000 : span.start + 3600_000;
  const showers: ShowerVisibility[] = SHOWERS.flatMap((sh) => {
    const { active, daysFromPeak } = showerFor(sh, date);
    if (!active) return [];
    const late = toHorizontal(sh.radiant, toJD(new Date(lateT)), place.lat, place.lon).alt;
    const early = toHorizontal(sh.radiant, toJD(new Date(earlyT)), place.lat, place.lon).alt;
    return [{ shower: sh, daysFromPeak, atPeak: Math.abs(daysFromPeak) <= 1, radiantAltLate: late, radiantAltEarly: early }];
  });

  return {
    date, key: dateKey(date), weekday: weekdayOf(date), place, timezone: tz, sun, span, dark, darkMinutes, moon, samples, galactic, planets, showers,
    hasForecast: !!forecast && samples.some((s) => s.cloud != null),
  };
}

/** The night that is "tonight" for an observer at `place` right now: the one in progress until sunrise, else the one coming. */
export function tonightDate(nowMs: number, place: LatLon, tz: string): LocalDate {
  const today = ((): LocalDate => {
    const d = new Date(nowMs);
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(d);
    const g = (t: string) => +(p.find((x) => x.type === t)?.value ?? 0);
    return { year: g('year'), month: g('month'), day: g('day') };
  })();
  const yesterday = addDays(today, -1);
  const n = buildNight(yesterday, place, tz);
  return nowMs < n.span.end ? yesterday : today;
}

export function bortleMid(b: Measure): number | null {
  if (b == null) return null;
  return typeof b === 'number' ? b : (b.min + b.max) / 2;
}
