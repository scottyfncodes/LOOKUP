import { describe, expect, it } from 'vitest';
import { buildForecastUrl, parsePointForecast } from '../../src/services/openMeteo';
import { buildTableUrl, parseTable } from '../../src/services/osrm';
import { maxKpBetween, parseKp } from '../../src/services/swpc';
import { parseGeocode, parseLatLon } from '../../src/services/geocode';
import { interpolate } from '../../src/core/forecast';

describe('open-meteo', () => {
  it('builds a keyless multi-point URL with unix times', () => {
    const u = new URL(buildForecastUrl([{ lat: 39.7392, lon: -104.9903 }, { lat: 37.7325, lon: -105.512 }], 10));
    expect(u.hostname).toBe('api.open-meteo.com');
    expect(u.searchParams.get('latitude')).toBe('39.7392,37.7325');
    expect(u.searchParams.get('timeformat')).toBe('unixtime');
    expect(u.searchParams.get('forecast_days')).toBe('10');
    expect(u.searchParams.get('hourly')).toContain('cloud_cover_high');
  });
  it('parses hourly rows and nulls out-of-range values', () => {
    const raw = {
      elevation: 1600, timezone: 'America/Denver',
      hourly: {
        time: [1_790_000_000, 1_790_003_600],
        cloud_cover: [20, 140], cloud_cover_low: [10, 10], cloud_cover_mid: [5, 5], cloud_cover_high: [5, 5],
        temperature_2m: [50, 48], relative_humidity_2m: [30, 35], dew_point_2m: [20, 21],
        wind_speed_10m: [5, 7], wind_gusts_10m: [9, 12], precipitation_probability: [0, 10], visibility: [24000, 24000],
      },
    };
    const f = parsePointForecast(raw, 1);
    expect(f.hours.length).toBe(2);
    expect(f.hours[0].t).toBe(1_790_000_000_000);
    expect(f.hours[0].cloud).toBe(20);
    expect(f.hours[1].cloud).toBeNull();
    expect(f.elevationM).toBe(1600);
    expect(f.timezone).toBe('America/Denver');
    expect(interpolate(f.hours, 'temp', 1_790_001_800_000)).toBe(49);
    expect(interpolate(f.hours, 'cloud', 1_790_001_800_000)).toBe(20);
  });
  it('rejects a payload with no hourly data', () => {
    expect(() => parsePointForecast({})).toThrow();
    expect(() => parsePointForecast({ hourly: { time: [] } })).toThrow();
  });
});

describe('osrm', () => {
  it('builds a table URL with home as source 0', () => {
    const u = buildTableUrl({ lat: 39.7, lon: -105 }, [{ lat: 37.7325, lon: -105.512 }]);
    expect(u).toContain('/table/v1/driving/-105.00000,39.70000;-105.51200,37.73250?sources=0');
  });
  it('parses durations and tolerates nulls', () => {
    const r = parseTable({ code: 'Ok', durations: [[0, 7200, null]], distances: [[0, 160934, null]] }, 2);
    expect(r[0]).toEqual({ minutes: 120, miles: 100 });
    expect(r[1]).toBeNull();
    expect(() => parseTable({ code: 'NoRoute' }, 1)).toThrow();
  });
});

describe('swpc', () => {
  it('parses the Kp table and finds the maximum in a window', () => {
    const raw = [
      ['time_tag', 'kp', 'observed', 'noaa_scale'],
      ['2026-09-26 18:00:00', '2.33', 'observed', null],
      ['2026-09-26 21:00:00', '3.00', 'estimated', null],
      ['2026-09-27 00:00:00', '7.33', 'predicted', 'G3'],
      ['2026-09-27 03:00:00', '4.00', 'predicted', null],
    ];
    const pts = parseKp(raw);
    expect(pts.length).toBe(4);
    expect(pts[2].kind).toBe('predicted');
    const start = Date.UTC(2026, 8, 27, 1), end = Date.UTC(2026, 8, 27, 12);
    expect(maxKpBetween(pts, start, end)).toBe(7.33);
    expect(maxKpBetween(pts, Date.UTC(2026, 8, 28), Date.UTC(2026, 8, 29))).toBeNull();
  });
});

describe('geocode', () => {
  it('parses results and skips broken rows', () => {
    const r = parseGeocode({ results: [{ name: 'Westcliffe', admin1: 'Colorado', country_code: 'US', latitude: 38.13, longitude: -105.47, elevation: 2400, timezone: 'America/Denver' }, { name: 'x' }] });
    expect(r.length).toBe(1);
    expect(r[0].admin1).toBe('Colorado');
    expect(parseGeocode({})).toEqual([]);
  });
  it('accepts typed coordinates', () => {
    expect(parseLatLon('39.7392, -104.9903')).toEqual({ lat: 39.7392, lon: -104.9903 });
    expect(parseLatLon('Denver')).toBeNull();
    expect(parseLatLon('95, 10')).toBeNull();
  });
});
