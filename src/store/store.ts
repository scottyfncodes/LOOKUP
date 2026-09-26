import { useSyncExternalStore } from 'react';
import type { Place } from '../core/types';
import type { Site } from '../data/sites';

/**
 * One state tree, localStorage-backed, no library. Preferences only: live
 * data (forecast, routing) has its own labelled cache in services/.
 */
export interface Prefs {
  /** Never assumed. Null until the user sets it. */
  home: Place | null;
  /** Bortle class the user entered for home, if any (rendered as "You entered"). */
  homeBortle: number | null;
  /** Latest time to be back home, minutes after local midnight (90 = 1:30 AM). Null = no limit. */
  latestHomeMinutes: number | null;
  /** Farthest the user will drive one way, minutes. */
  maxDriveMinutes: number;
  redMode: boolean;
  customSites: Site[];
  hiddenSiteIds: string[];
  /** Explicitly chosen site for tonight; null = let LOOKUP pick. */
  selectedSiteId: string | null;
  /** Explicitly chosen night, YYYY-MM-DD; null = tonight. */
  selectedDate: string | null;
}

const KEY = 'lookup:prefs:v1';

export const DEFAULT_PREFS: Prefs = {
  home: null,
  homeBortle: null,
  latestHomeMinutes: 90,
  maxDriveMinutes: 180,
  redMode: false,
  customSites: [],
  hiddenSiteIds: [],
  selectedSiteId: null,
  selectedDate: null,
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...p };
  } catch {
    return DEFAULT_PREFS;
  }
}

let state: Prefs = load();
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  return state;
}

export function setPrefs(patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)): void {
  const next = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: preferences live for the session only */
  }
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function exportPrefs(): string {
  return JSON.stringify(state, null, 2);
}

export function importPrefs(json: string): boolean {
  try {
    const p = JSON.parse(json) as Partial<Prefs>;
    if (!p || typeof p !== 'object') return false;
    setPrefs({ ...DEFAULT_PREFS, ...p });
    return true;
  } catch {
    return false;
  }
}
