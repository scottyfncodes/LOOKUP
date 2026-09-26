import { useEffect, useMemo, useState } from 'react';
import { darkCalendar, type CalendarNight } from '../core/engine/calendar';
import { buildNight, tonightDate, type Night } from '../core/engine/night';
import { buildTimeline, type DriveInfo, type Timeline } from '../core/engine/plan';
import { scoreNight, type Score } from '../core/engine/score';
import type { PointForecast } from '../core/forecast';
import { addDays, dateKey, parseDateKey, zonedToUtc, type LocalDate } from '../core/time';
import type { Measure } from '../core/types';
import { SITES, type Site } from '../data/sites';
import { fetchForecasts } from '../services/openMeteo';
import { fetchDriveTimes } from '../services/osrm';
import { fetchKp, maxKpBetween, type KpPoint } from '../services/swpc';
import { usePrefs, type Prefs } from './store';

export const HOME_ID = 'home';
export const DEFAULT_TZ = 'America/Denver';

export interface SiteNight {
  site: Site;
  night: Night;
  score: Score;
  drive: DriveInfo | null;
  timeline: Timeline | null;
  forecast: PointForecast | null;
  /** True when the site is farther than the user's drive limit (still shown, ranked last). */
  tooFar: boolean;
}

export interface NightData {
  date: LocalDate;
  tonight: LocalDate;
  isTonight: boolean;
  nights: SiteNight[];
  /** Ranked: best score first, unknowns after known, too-far last. */
  ranked: SiteNight[];
  selected: SiteNight | null;
  loading: boolean;
  forecastError: boolean;
  kp: KpPoint[] | null;
  kpMax: number | null;
  week: Array<{ date: LocalDate; night: Night; score: Score }>;
  calendar: CalendarNight[];
  now: number;
  homeSite: Site | null;
}

export function allSites(prefs: Prefs): Site[] {
  const hidden = new Set(prefs.hiddenSiteIds);
  return [...SITES, ...prefs.customSites].filter((s) => !hidden.has(s.id));
}

export function homeAsSite(prefs: Prefs): Site | null {
  if (!prefs.home) return null;
  const bortle: Measure = prefs.homeBortle ?? null;
  return {
    id: HOME_ID,
    name: 'Home sky',
    region: prefs.home.name,
    lat: prefs.home.lat,
    lon: prefs.home.lon,
    elevationM: prefs.home.elevationM ?? null,
    timezone: prefs.home.timezone ?? DEFAULT_TZ,
    designation: 'none',
    certifiedYear: null,
    bortle,
    notes: ['No drive, no setup: the baseline every other site has to beat.'],
    sources: [{ label: bortle == null ? 'Light pollution not entered' : 'You entered the Bortle class', confidence: 'user' }],
  };
}

function latestHomeFor(date: LocalDate, prefs: Prefs, tz: string): number | null {
  if (prefs.latestHomeMinutes == null) return null;
  const next = addDays(date, 1);
  return zonedToUtc(next.year, next.month, next.day, 0, 0, tz) + prefs.latestHomeMinutes * 60_000;
}

export function useNightData(): NightData {
  const prefs = usePrefs();
  const [now, setNow] = useState(() => Date.now());
  const [forecasts, setForecasts] = useState<Record<string, PointForecast | null>>({});
  const [drives, setDrives] = useState<Record<string, DriveInfo>>({});
  const [kp, setKp] = useState<KpPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [forecastError, setForecastError] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sites = useMemo(() => {
    const list = allSites(prefs);
    const home = homeAsSite(prefs);
    return home ? [home, ...list] : list;
  }, [prefs]);

  const siteKey = sites.map((s) => `${s.id}:${s.lat.toFixed(3)},${s.lon.toFixed(3)}`).join('|');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setForecastError(false);
    fetchForecasts(sites.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon })), 10)
      .then((f) => {
        if (cancelled) return;
        setForecasts(f);
        if (Object.values(f).every((v) => v == null)) setForecastError(true);
      })
      .catch(() => {
        if (!cancelled) setForecastError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  const homeKey = prefs.home ? `${prefs.home.lat.toFixed(3)},${prefs.home.lon.toFixed(3)}` : '';
  useEffect(() => {
    if (!prefs.home) {
      setDrives({});
      return;
    }
    let cancelled = false;
    const dests = sites.filter((s) => s.id !== HOME_ID).map((s) => ({ id: s.id, lat: s.lat, lon: s.lon }));
    fetchDriveTimes(prefs.home, dests).then((d) => {
      if (!cancelled) setDrives(d);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeKey, siteKey]);

  useEffect(() => {
    let cancelled = false;
    fetchKp().then((k) => {
      if (!cancelled) setKp(k);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refPlace = prefs.home ?? sites[0];
  const refTz = refPlace?.timezone ?? DEFAULT_TZ;
  const tonight = useMemo(() => tonightDate(now, refPlace, refTz), [now, refPlace, refTz]);
  const date = prefs.selectedDate ? parseDateKey(prefs.selectedDate) : tonight;
  const isTonight = dateKey(date) === dateKey(tonight);

  const nights = useMemo<SiteNight[]>(() => {
    return sites.map((site) => {
      const tz = site.timezone ?? DEFAULT_TZ;
      const fc = forecasts[site.id] ?? null;
      const night = buildNight(date, site, tz, { forecast: fc?.hours ?? null });
      const drive = site.id === HOME_ID ? { minutes: 0, miles: 0, source: { label: 'You are already here', confidence: 'computed' as const } } : drives[site.id] ?? null;
      const latestHome = latestHomeFor(date, prefs, tz);
      const latestAtSite = latestHome != null ? latestHome - (drive?.minutes ?? 0) * 60_000 : null;
      const kpMax = kp ? maxKpBetween(kp, night.span.start, night.span.end) : null;
      const score = scoreNight({ night, bortle: site.bortle, forecast: fc?.hours ?? null, latestAtSite, kpMax });
      const timeline = score.window ? buildTimeline(score.window, drive, latestHome) : null;
      const tooFar = drive != null && drive.minutes > prefs.maxDriveMinutes;
      return { site, night, score, drive, timeline, forecast: fc, tooFar };
    });
  }, [sites, forecasts, drives, kp, date, prefs]);

  const ranked = useMemo(() => {
    const rank = (n: SiteNight) => (n.tooFar ? 2 : n.score.value == null ? 1 : 0);
    return [...nights].sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      const va = a.score.value ?? a.score.ifClear, vb = b.score.value ?? b.score.ifClear;
      if (Math.abs(va - vb) > 0.05) return vb - va;
      return (a.drive?.minutes ?? 0) - (b.drive?.minutes ?? 0);
    });
  }, [nights]);

  const selected = useMemo(() => {
    if (prefs.selectedSiteId) {
      const hit = nights.find((n) => n.site.id === prefs.selectedSiteId);
      if (hit) return hit;
    }
    return ranked.find((n) => !n.tooFar) ?? ranked[0] ?? null;
  }, [prefs.selectedSiteId, nights, ranked]);

  const week = useMemo(() => {
    if (!selected) return [];
    const site = selected.site;
    const tz = site.timezone ?? DEFAULT_TZ;
    const fc = forecasts[site.id] ?? null;
    const out: Array<{ date: LocalDate; night: Night; score: Score }> = [];
    for (let i = 0; i < 10; i++) {
      const d = addDays(tonight, i);
      const night = buildNight(d, site, tz, { forecast: fc?.hours ?? null });
      const latestHome = latestHomeFor(d, prefs, tz);
      const latestAtSite = latestHome != null ? latestHome - (selected.drive?.minutes ?? 0) * 60_000 : null;
      out.push({ date: d, night, score: scoreNight({ night, bortle: site.bortle, forecast: fc?.hours ?? null, latestAtSite }) });
    }
    return out;
  }, [selected, forecasts, tonight, prefs]);

  const calendar = useMemo(() => {
    const place = selected?.site ?? refPlace;
    return darkCalendar(tonight, 45, place, place?.timezone ?? refTz);
  }, [selected, refPlace, refTz, tonight]);

  const kpMax = useMemo(() => (kp && selected ? maxKpBetween(kp, selected.night.span.start, selected.night.span.end) : null), [kp, selected]);

  return { date, tonight, isTonight, nights, ranked, selected, loading, forecastError, kp, kpMax, week, calendar, now, homeSite: homeAsSite(prefs) };
}
