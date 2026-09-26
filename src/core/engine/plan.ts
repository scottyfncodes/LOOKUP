import type { Source } from '../types';
import type { BestWindow } from './score';

/** Dark adaptation plus getting set up: the reason to arrive before the window opens. */
export const SETUP_MINUTES = 25;

export interface DriveInfo {
  minutes: number;
  miles: number | null;
  source: Source;
}

export interface Timeline {
  leaveHome: number;
  arrive: number;
  windowStart: number;
  windowEnd: number;
  leaveSite: number;
  home: number;
  /** True when the window had to be cut to make the latest-home time. */
  clipped: boolean;
}

/**
 * Turn a window into a night. If a latest-home time is set and the drive back
 * would blow through it, the window is clipped (never the drive).
 */
export function buildTimeline(win: BestWindow, drive: DriveInfo | null, latestHome: number | null): Timeline | null {
  const d = (drive?.minutes ?? 0) * 60_000;
  let end = win.end;
  let clipped = false;
  if (latestHome != null && end + d > latestHome) {
    end = latestHome - d;
    clipped = true;
  }
  if (end - win.start < 45 * 60_000) return null;
  const arrive = win.start - SETUP_MINUTES * 60_000;
  return {
    leaveHome: arrive - d,
    arrive,
    windowStart: win.start,
    windowEnd: end,
    leaveSite: end,
    home: end + d,
    clipped,
  };
}
