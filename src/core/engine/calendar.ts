import type { LatLon } from '../types';
import { addDays, type LocalDate } from '../time';
import { buildNight, type Night } from './night';

export interface CalendarNight {
  night: Night;
  /** Moon-free astronomical dark, minutes. */
  moonFreeDarkMinutes: number;
  /** Friday or Saturday night. */
  weekend: boolean;
  /** 0–1 share of the dark that is moon-free. */
  share: number;
}

/** Sky-only outlook for the next `days` nights: what the Moon leaves you, weather unknown. */
export function darkCalendar(from: LocalDate, days: number, place: LatLon, tz: string): CalendarNight[] {
  const out: CalendarNight[] = [];
  for (let i = 0; i < days; i++) {
    const night = buildNight(addDays(from, i), place, tz);
    out.push({
      night,
      moonFreeDarkMinutes: night.moon.moonFreeDarkMinutes,
      weekend: night.weekday === 5 || night.weekday === 6,
      share: night.darkMinutes > 0 ? night.moon.moonFreeDarkMinutes / night.darkMinutes : 0,
    });
  }
  return out;
}

/** The next weekend night with ≥ 4 h of moon-free dark, if any within the calendar. */
export function nextDarkWeekend(cal: CalendarNight[]): CalendarNight | null {
  return cal.find((c) => c.weekend && c.moonFreeDarkMinutes >= 240) ?? null;
}
