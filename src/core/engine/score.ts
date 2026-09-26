import type { Confidence, Measure } from '../types';
import { bortleMid, type Night, type NightSample, type Window } from './night';
import { interpolate, type HourForecast } from '../forecast';
import { fmtDuration, fmtTime } from '../time';

/**
 * The call. Every factor that moves the number leaves a reason with its
 * provenance, so the WHY list is the scoring function turned inside out.
 */

export type Tier = 'go' | 'worth' | 'marginal' | 'skip' | 'unknown';

export interface Reason {
  text: string;
  confidence: Confidence;
  effect: 'plus' | 'minus' | 'neutral';
}

export interface BestWindow extends Window {
  /** Mean sky quality across the window, 0–1 (Moon and clouds when known; Moon alone otherwise). */
  meanQuality: number;
  /** Mean cloud cover across the window, % (null when no forecast). */
  meanCloud: number | null;
  /** Whether the Moon is below the horizon for the whole window. */
  moonFree: boolean;
}

export interface Score {
  /** 0–10 with a forecast; null without one. */
  value: number | null;
  /** 0–10 from astronomy and site alone: what the night would be under a clear sky. */
  ifClear: number;
  tier: Tier;
  headline: string;
  reasons: Reason[];
  window: BestWindow | null;
  /** Comfort readings at the window midpoint, from the forecast. */
  comfort: { temp: number | null; wind: number | null; gust: number | null; humidity: number | null; precipProb: number | null };
}

export interface ScoreInputs {
  night: Night;
  bortle: Measure;
  forecast?: HourForecast[] | null;
  /** Latest instant the observer is willing to still be at the site (epoch ms), if any. */
  latestAtSite?: number | null;
  /** Earliest instant they can be at the site (epoch ms), if any. */
  earliestAtSite?: number | null;
  /** Planetary K index forecast for the night, if known. */
  kpMax?: number | null;
}

export const TIER_LABEL: Record<Tier, string> = {
  go: 'GO. LOOK UP.',
  worth: 'WORTH IT',
  marginal: 'MARGINAL',
  skip: 'STAY IN',
  unknown: 'NO FORECAST',
};

export function lightPollutionFactor(bortle: Measure): { factor: number; known: boolean } {
  const mid = bortleMid(bortle);
  if (mid == null) return { factor: 0.85, known: false };
  const table = [1, 0.97, 0.9, 0.78, 0.62, 0.45, 0.3, 0.2, 0.1];
  const i = Math.max(0, Math.min(8, Math.round(mid) - 1));
  return { factor: table[i], known: true };
}

function tierOf(v: number | null): Tier {
  if (v == null) return 'unknown';
  if (v >= 7.5) return 'go';
  if (v >= 5.5) return 'worth';
  if (v >= 3.5) return 'marginal';
  return 'skip';
}

/**
 * Best window: the 2-hour stretch with the highest mean quality, grown outward
 * while the sky stays at least 70% as good. Only astronomically dark samples
 * inside the observer's constraints are eligible.
 */
export function bestWindow(samples: NightSample[], useForecast: boolean, from?: number | null, to?: number | null): BestWindow | null {
  const q = (s: NightSample) => (useForecast ? s.quality ?? 0 : s.skyQuality);
  const eligible = samples.filter((s) => s.dark && (from == null || s.t >= from) && (to == null || s.t + 15 * 60_000 <= to));
  if (eligible.length === 0) return null;
  const n = Math.min(eligible.length, 8); // 8 × 15 min = 2 h
  let bestI = 0, bestMean = -1;
  for (let i = 0; i + n <= eligible.length; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) sum += q(eligible[i + k]);
    const mean = sum / n;
    if (mean > bestMean) { bestMean = mean; bestI = i; }
  }
  let lo = bestI, hi = bestI + n - 1;
  const floor = Math.max(0.35, bestMean * 0.7);
  // Contiguity in time matters: do not grow across a gap in eligibility.
  const contiguous = (a: number, b: number) => eligible[b].t - eligible[a].t === 15 * 60_000;
  while (lo > 0 && q(eligible[lo - 1]) >= floor && contiguous(lo - 1, lo)) lo--;
  while (hi < eligible.length - 1 && q(eligible[hi + 1]) >= floor && contiguous(hi, hi + 1)) hi++;
  const win = eligible.slice(lo, hi + 1);
  const meanQ = win.reduce((a, s) => a + q(s), 0) / win.length;
  const clouds = win.map((s) => s.cloud).filter((c): c is number => c != null);
  return {
    start: win[0].t,
    end: win[win.length - 1].t + 15 * 60_000,
    meanQuality: meanQ,
    meanCloud: clouds.length ? clouds.reduce((a, b) => a + b, 0) / clouds.length : null,
    moonFree: win.every((s) => s.moonAlt < 0),
  };
}

export function scoreNight(inp: ScoreInputs): Score {
  const { night, bortle } = inp;
  const tz = night.timezone;
  const reasons: Reason[] = [];
  const hasForecast = night.hasForecast;
  const lp = lightPollutionFactor(bortle);
  const comfort = { temp: null as number | null, wind: null as number | null, gust: null as number | null, humidity: null as number | null, precipProb: null as number | null };

  if (!night.dark) {
    reasons.push({ text: 'No astronomical darkness at this latitude tonight.', confidence: 'computed', effect: 'minus' });
    return { value: hasForecast ? 0 : null, ifClear: 0, tier: hasForecast ? 'skip' : 'unknown', headline: 'It never gets fully dark.', reasons, window: null, comfort };
  }

  const winClear = bestWindow(night.samples, false, inp.earliestAtSite, inp.latestAtSite);
  const win = hasForecast ? bestWindow(night.samples, true, inp.earliestAtSite, inp.latestAtSite) : winClear;

  if (!win || !winClear) {
    reasons.push({ text: 'Darkness falls outside the hours you can be out.', confidence: 'computed', effect: 'minus' });
    return { value: hasForecast ? 0 : null, ifClear: 0, tier: hasForecast ? 'skip' : 'unknown', headline: 'No dark window inside your hours.', reasons, window: null, comfort };
  }

  const durationFactor = (w: Window) => Math.max(0.5, Math.min(1, 0.5 + (w.end - w.start) / 60_000 / 240));

  // --- Sky-only number (what a clear night would be) ---
  let ifClear = winClear.meanQuality * 10 * lp.factor * durationFactor(winClear);

  // --- Moon reasons (computed) ---
  const pct = Math.round(night.moon.illumination * 100);
  if (night.moon.moonFreeDarkMinutes >= night.darkMinutes - 20) {
    reasons.push({ text: `${night.moon.phase}: the Moon stays down all night.`, confidence: 'computed', effect: 'plus' });
  } else if (night.moon.illumination < 0.2) {
    reasons.push({ text: `${night.moon.phase} at ${pct}%: too thin to matter.`, confidence: 'computed', effect: 'plus' });
  } else if (win.moonFree) {
    const ev = night.moon.sets[0] != null && night.moon.sets[0] <= win.start ? `sets ${fmtTime(night.moon.sets[0], tz)}` : night.moon.rises[0] != null ? `rises ${fmtTime(night.moon.rises[0], tz)}` : 'is down';
    reasons.push({ text: `${pct}% Moon ${ev}; your window is moon-free.`, confidence: 'computed', effect: 'plus' });
  } else if (night.moon.illumination >= 0.85) {
    reasons.push({ text: `${night.moon.phase} at ${pct}%, up during your window: bright sky, faint stuff gone.`, confidence: 'computed', effect: 'minus' });
  } else {
    reasons.push({ text: `${pct}% Moon up during your window costs you the fainter sky.`, confidence: 'computed', effect: 'minus' });
  }
  reasons.push({ text: `Astronomical dark ${fmtTime(night.dark.start, tz)}–${fmtTime(night.dark.end, tz)} (${fmtDuration(night.darkMinutes)}), ${fmtDuration(night.moon.moonFreeDarkMinutes)} of it moon-free.`, confidence: 'computed', effect: 'neutral' });

  // --- Light pollution (official designation + estimate) ---
  if (!lp.known) reasons.push({ text: 'Light pollution here is UNKNOWN; scored as if moderately dark.', confidence: 'estimate', effect: 'neutral' });
  else if (lp.factor >= 0.9) reasons.push({ text: 'Dark site: light pollution is not the limit tonight.', confidence: 'estimate', effect: 'plus' });
  else if (lp.factor <= 0.45) reasons.push({ text: 'Skyglow here caps the night regardless of weather.', confidence: 'estimate', effect: 'minus' });
  else reasons.push({ text: 'Some skyglow; the brighter showpieces still work.', confidence: 'estimate', effect: 'neutral' });

  // --- Bonuses (computed) ---
  let bonus = 0;
  const upDuring = (w: Window | null) => w != null && w.start < win.end && w.end > win.start;
  if (night.galactic.window && upDuring(night.galactic.window) && night.galactic.maxAlt >= 15) {
    bonus += 0.3;
    reasons.push({ text: `Milky Way core up in the ${night.galactic.direction} until ${fmtTime(night.galactic.window.end, tz)}.`, confidence: 'computed', effect: 'plus' });
  }
  const bright = night.planets.filter((p) => p.id !== 'mercury' && p.window && upDuring(p.window) && p.maxAlt >= 15);
  if (bright.length) {
    bonus += Math.min(0.3, 0.1 * bright.length);
    reasons.push({ text: `${bright.map((p) => `${p.name} (${p.direction})`).join(', ')} up during the window.`, confidence: 'computed', effect: 'plus' });
  }
  const peakShower = night.showers.find((s) => s.atPeak && s.radiantAltLate > 20);
  const bigShower = night.showers.find((s) => !s.atPeak && Math.abs(s.daysFromPeak) <= 3 && s.shower.zhr >= 50 && s.radiantAltLate > 20);
  if (peakShower) {
    bonus += 0.6;
    reasons.push({ text: `${peakShower.shower.name} peak: up to ${peakShower.shower.zhr}/h under ideal skies, radiant ${Math.round(peakShower.radiantAltLate)}° up before dawn.`, confidence: 'official', effect: 'plus' });
  } else if (bigShower) {
    bonus += 0.3;
    reasons.push({ text: `${bigShower.shower.name} ${bigShower.daysFromPeak < 0 ? 'building' : 'tailing off'}, ${Math.abs(bigShower.daysFromPeak)} days from peak.`, confidence: 'official', effect: 'plus' });
  }
  if (inp.kpMax != null && inp.kpMax >= 7) {
    bonus += 0.5;
    reasons.push({ text: `Kp ${inp.kpMax} forecast: aurora possible on the northern horizon at this latitude.`, confidence: 'forecast', effect: 'plus' });
  }
  ifClear = Math.min(10, ifClear + bonus);

  if (!hasForecast) {
    reasons.unshift({ text: 'No cloud forecast for this night: the sky can only be scored as if clear.', confidence: 'forecast', effect: 'neutral' });
    return {
      value: null, ifClear, tier: 'unknown',
      headline: `If it's clear: ${ifClear.toFixed(1)}.`,
      reasons, window: winClear, comfort,
    };
  }

  // --- With forecast ---
  let value = win.meanQuality * 10 * lp.factor * durationFactor(win) + bonus;
  const mc = win.meanCloud ?? 0;
  if (mc <= 15) reasons.unshift({ text: `Clear during your window (${Math.round(mc)}% cloud).`, confidence: 'forecast', effect: 'plus' });
  else if (mc <= 40) reasons.unshift({ text: `Some cloud during your window (${Math.round(mc)}%): gaps, not a ceiling.`, confidence: 'forecast', effect: 'neutral' });
  else if (mc <= 70) reasons.unshift({ text: `Mostly cloudy in your window (${Math.round(mc)}%).`, confidence: 'forecast', effect: 'minus' });
  else reasons.unshift({ text: `Overcast in your window (${Math.round(mc)}% cloud).`, confidence: 'forecast', effect: 'minus' });

  const fc = inp.forecast ?? [];
  const mid = (win.start + win.end) / 2;
  comfort.temp = interpolate(fc, 'temp', mid);
  comfort.wind = interpolate(fc, 'wind', mid);
  comfort.gust = interpolate(fc, 'gust', mid);
  comfort.humidity = interpolate(fc, 'humidity', mid);
  comfort.precipProb = interpolate(fc, 'precipProb', mid);
  if (comfort.wind != null) {
    if (comfort.wind >= 25) { value -= 1; reasons.push({ text: `Wind ${Math.round(comfort.wind)} mph: tripods shake, fingers quit.`, confidence: 'forecast', effect: 'minus' }); }
    else if (comfort.wind >= 15) { value -= 0.4; reasons.push({ text: `Breezy, ${Math.round(comfort.wind)} mph.`, confidence: 'forecast', effect: 'minus' }); }
  }
  if (comfort.temp != null) {
    if (comfort.temp <= 10) { value -= 0.8; reasons.push({ text: `${Math.round(comfort.temp)}°F at the window midpoint: dress for it or keep it short.`, confidence: 'forecast', effect: 'minus' }); }
    else if (comfort.temp <= 25) { value -= 0.3; reasons.push({ text: `${Math.round(comfort.temp)}°F: cold enough to plan for.`, confidence: 'forecast', effect: 'minus' }); }
  }
  if (comfort.precipProb != null && comfort.precipProb >= 50) { value -= 1; reasons.push({ text: `${Math.round(comfort.precipProb)}% chance of precipitation.`, confidence: 'forecast', effect: 'minus' }); }
  if (comfort.humidity != null && comfort.humidity >= 90) { value -= 0.3; reasons.push({ text: `Humidity ${Math.round(comfort.humidity)}%: dew on lenses, softer transparency.`, confidence: 'forecast', effect: 'minus' }); }

  value = Math.max(0, Math.min(10, value));
  const tier = tierOf(value);
  const headline =
    tier === 'go' ? 'Tonight is the night.' :
    tier === 'worth' ? 'Good enough to go.' :
    tier === 'marginal' ? 'Only if you were going anyway.' : 'Save the drive.';
  return { value, ifClear, tier, headline, reasons, window: win, comfort };
}
