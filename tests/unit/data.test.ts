import { describe, expect, it } from 'vitest';
import { SITES } from '../../src/data/sites';
import { SHOWERS } from '../../src/data/showers';

describe('site records', () => {
  it('have unique ids and Colorado-plausible coordinates', () => {
    const ids = new Set(SITES.map((s) => s.id));
    expect(ids.size).toBe(SITES.length);
    for (const s of SITES) {
      expect(s.lat).toBeGreaterThan(36.9);
      expect(s.lat).toBeLessThan(41.1);
      expect(s.lon).toBeGreaterThan(-109.2);
      expect(s.lon).toBeLessThan(-102);
    }
  });
  it('every record carries at least one source with a confidence, and certified sites cite DarkSky', () => {
    for (const s of SITES) {
      expect(s.sources.length).toBeGreaterThan(0);
      for (const src of s.sources) expect(['computed', 'forecast', 'official', 'estimate', 'user']).toContain(src.confidence);
      if (s.designation !== 'none') {
        expect(s.sources.some((x) => /DarkSky/.test(x.label) && x.confidence === 'official' && x.checked)).toBe(true);
      }
    }
  });
  it('Bortle is null or a range whose estimate is declared', () => {
    for (const s of SITES) {
      if (s.bortle == null) continue;
      expect(s.sources.some((x) => x.confidence === 'estimate')).toBe(true);
      if (typeof s.bortle === 'object') expect(s.bortle.min).toBeLessThanOrEqual(s.bortle.max);
    }
  });
});

describe('shower catalogue', () => {
  it('has unique ids, sane peaks and radiants', () => {
    expect(new Set(SHOWERS.map((s) => s.id)).size).toBe(SHOWERS.length);
    for (const s of SHOWERS) {
      expect(s.peak.month).toBeGreaterThanOrEqual(1);
      expect(s.peak.month).toBeLessThanOrEqual(12);
      expect(s.zhr).toBeGreaterThan(0);
      expect(Math.abs(s.radiant.dec)).toBeLessThanOrEqual(90);
    }
  });
});
