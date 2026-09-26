import type { Equatorial } from '../core/astro/coords';
import type { Source } from '../core/types';

/**
 * Annual meteor showers. Peak dates drift by a day or so year to year and the
 * IMO calendar for the year in question is the authority; these are the
 * long-run values and are labelled as such wherever they are shown.
 */
export interface Shower {
  id: string;
  name: string;
  /** Month/day of the long-run peak (UTC-agnostic; shower peaks are broad). */
  peak: { month: number; day: number };
  /** Activity window, month/day. May wrap the year (Quadrantids). */
  active: { from: { month: number; day: number }; to: { month: number; day: number } };
  /** Zenithal hourly rate at peak under ideal skies: an upper bound, never a promise. */
  zhr: number;
  radiant: Equatorial;
  /** Parent body when well established. */
  parent?: string;
  note?: string;
}

export const SHOWER_SOURCE: Source = {
  label: 'International Meteor Organization working list of visual meteor showers',
  url: 'https://www.imo.net/resources/calendar/',
  confidence: 'official',
  checked: '2026-09-26',
};

export const SHOWERS: Shower[] = [
  { id: 'qua', name: 'Quadrantids', peak: { month: 1, day: 3 }, active: { from: { month: 12, day: 28 }, to: { month: 1, day: 12 } }, zhr: 110, radiant: { ra: 230, dec: 49 }, parent: '2003 EH1', note: 'Sharp peak of only a few hours; cold and worth it.' },
  { id: 'lyr', name: 'Lyrids', peak: { month: 4, day: 22 }, active: { from: { month: 4, day: 14 }, to: { month: 4, day: 30 } }, zhr: 18, radiant: { ra: 271, dec: 34 }, parent: 'C/1861 G1 Thatcher' },
  { id: 'eta', name: 'Eta Aquariids', peak: { month: 5, day: 6 }, active: { from: { month: 4, day: 19 }, to: { month: 5, day: 28 } }, zhr: 50, radiant: { ra: 338, dec: -1 }, parent: '1P/Halley', note: 'Radiant rises late; best in the last two hours before dawn.' },
  { id: 'sda', name: 'Southern Delta Aquariids', peak: { month: 7, day: 30 }, active: { from: { month: 7, day: 12 }, to: { month: 8, day: 23 } }, zhr: 25, radiant: { ra: 340, dec: -16 } },
  { id: 'per', name: 'Perseids', peak: { month: 8, day: 12 }, active: { from: { month: 7, day: 17 }, to: { month: 8, day: 24 } }, zhr: 100, radiant: { ra: 48, dec: 58 }, parent: '109P/Swift-Tuttle', note: 'The warm-weather classic. Radiant climbs all night.' },
  { id: 'dra', name: 'Draconids', peak: { month: 10, day: 8 }, active: { from: { month: 10, day: 6 }, to: { month: 10, day: 10 } }, zhr: 10, radiant: { ra: 262, dec: 54 }, parent: '21P/Giacobini-Zinner', note: 'Unusually, an evening shower: the radiant is highest at nightfall. Rates vary wildly by year.' },
  { id: 'ori', name: 'Orionids', peak: { month: 10, day: 21 }, active: { from: { month: 10, day: 2 }, to: { month: 11, day: 7 } }, zhr: 20, radiant: { ra: 95, dec: 16 }, parent: '1P/Halley', note: 'Fast meteors, often with persistent trains. Best after midnight.' },
  { id: 'sta', name: 'Southern Taurids', peak: { month: 11, day: 5 }, active: { from: { month: 9, day: 10 }, to: { month: 11, day: 20 } }, zhr: 5, radiant: { ra: 52, dec: 15 }, parent: '2P/Encke', note: 'Low rates, but slow bright fireballs.' },
  { id: 'nta', name: 'Northern Taurids', peak: { month: 11, day: 12 }, active: { from: { month: 10, day: 20 }, to: { month: 12, day: 10 } }, zhr: 5, radiant: { ra: 58, dec: 22 }, parent: '2P/Encke' },
  { id: 'leo', name: 'Leonids', peak: { month: 11, day: 17 }, active: { from: { month: 11, day: 6 }, to: { month: 11, day: 30 } }, zhr: 15, radiant: { ra: 152, dec: 22 }, parent: '55P/Tempel-Tuttle', note: 'Radiant rises around midnight.' },
  { id: 'gem', name: 'Geminids', peak: { month: 12, day: 14 }, active: { from: { month: 12, day: 4 }, to: { month: 12, day: 20 } }, zhr: 150, radiant: { ra: 112, dec: 33 }, parent: '3200 Phaethon', note: 'The strongest shower of the year, and the radiant is up all night.' },
  { id: 'urs', name: 'Ursids', peak: { month: 12, day: 22 }, active: { from: { month: 12, day: 17 }, to: { month: 12, day: 26 } }, zhr: 10, radiant: { ra: 217, dec: 76 }, parent: '8P/Tuttle' },
];
