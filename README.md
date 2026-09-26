# LOOKUP

**Is tonight worth going out for?**

LOOKUP is a decision engine for nights under the stars. Not a planetarium, not
a weather app, not a list of dark-sky parks: one app that takes the Moon, the
twilight, the Milky Way, the planets, the meteor showers, the cloud forecast,
the light pollution and the drive, and turns them into a call with a why.

```
GREAT SAND DUNES
9.6
GO. LOOK UP.

Leave 5:40 PM · Arrive 9:05 PM
Window 9:30 PM – 1:10 AM · moon-free
Home 4:45 AM
```

**Live: https://scottyfncodes.github.io/Fable/** — open it on a phone and use
*Add to Home Screen*. It runs standalone, offline-capable, dark by default,
and has a red night-vision mode for when you get out of the car.

## The loop

```
WHEN → WHERE → HOW DARK → HOW CLEAR → THE CALL → LEAVE / ARRIVE / WINDOW / HOME
```

| Tab | What it answers |
| --- | --- |
| **Tonight** | The call for one site on one night: score, verdict, leave / arrive / window / home, the whole night on one strip, and every reason with its provenance. |
| **Sites** | Twenty-one Colorado dark-sky sites plus your home sky, ranked for the night by sky, clouds, light pollution and how far you said you'd drive. Add your own. |
| **Later** | Ten nights with a forecast, then 45 nights of the Moon alone, with the next dark weekend called out. |
| **Sky** | What is actually up: Moon phase and rise/set, next new and full Moon, darkness times, Milky Way core window, bright planets with where to look, active and upcoming meteor showers, aurora Kp. |
| **More** | Home, latest-home time, drive limit, night-vision mode, sites, export/import. |

## The rule that shapes everything

**Never invent a number.** Every value in LOOKUP carries one of five labels,
rendered next to it, never hidden:

| Label | Means |
| --- | --- |
| `computed` | Astronomy: deterministic from time and place, calculated on the phone |
| `forecast` | A weather or space-weather model said so |
| `official` | A published designation or catalogue |
| `estimate` | LOOKUP's own estimate, labelled as such |
| `you entered` | You typed it |

Where nothing defensible is known the value is `null` and renders **UNKNOWN**.
The Bortle class of each site is a *range* and an *estimate*: DarkSky
International certifies places but does not publish Bortle classes, and no
light-pollution map was read for this build. Drive times come from OSRM with
no live traffic and no seasonal closures, and say so. If the cloud forecast
cannot be fetched, the night is scored **as if clear**, the tier reads **NO
FORECAST**, and the first reason says why.

LOOKUP never assumes where you live. Home comes from a typed town, typed
coordinates, or a location button you press.

## How the call is made

Every night is sampled every 15 minutes from sunset to sunrise.

1. **Darkness.** Sun altitude gives the twilights; astronomical dark is the
   only time that counts.
2. **Moon.** Illumination and altitude combine into an interference figure: a
   20% crescent low in the west is nothing, a full Moon overhead ends the night.
3. **Clouds.** Hourly total cloud cover from Open-Meteo, interpolated.
4. **Window.** The best two-hour stretch, grown while the sky stays at least
   70% as good, clipped to the hours you can be at the site.
5. **Score.** Mean window quality × light-pollution factor × duration factor,
   with bonuses for a Milky Way core ≥ 15° up, bright planets, a meteor shower
   at peak, or a Kp ≥ 7 aurora forecast, and comfort penalties for wind, cold,
   precipitation and dew.
6. **Verdict.** ≥ 7.5 **GO. LOOK UP.** · ≥ 5.5 **WORTH IT** · ≥ 3.5 **MARGINAL** ·
   else **STAY IN** · no forecast → **NO FORECAST**, with an *if clear* number.
7. **Timeline.** Arrive 25 minutes before the window so your eyes adapt while
   it gets dark. If a latest-home time is set, the window is cut to make it;
   the drive never is.

## Astronomy

All of it runs in the browser, none of it needs the network, and it is tested
against the worked examples in Meeus, *Astronomical Algorithms*:

- **Sun**: ch. 25 low-precision solution (~0.01°), true obliquity, apparent RA/Dec.
- **Moon**: ch. 47, the full 60-term ELP-2000/82 truncation in longitude,
  distance and latitude (~10″), topocentric altitude, illuminated fraction,
  phase, and a bisection search for the next new and full Moon.
- **Sidereal time**: ch. 12. **ΔT**: polynomial fit, 1980–2050.
- **Planets**: JPL approximate Keplerian elements (1800–2050), good to a
  fraction of a degree, which is exactly enough for "Saturn, low in the SSE".
- **Milky Way core**: Sgr A* (RA 17h45.7m, Dec −29.0°) tracked through the night.
- **Rise, set and twilight**: one threshold-crossing solver, sampling then
  bisecting, so a night with no astronomical darkness returns *none* rather
  than a wrong time.
- **Meteor showers**: the IMO working list with long-run peaks, ZHR and
  radiants; radiant altitude computed for early and late in the night.

## Data

| Source | Used for | Key |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/) | Hourly cloud cover, temperature, humidity, wind, precipitation probability, 10 days, one request for every site | none |
| [OSRM](https://project-osrm.org/) public demo server | Drive time and distance from home to every site in one table request; falls back to a labelled straight-line estimate | none |
| [NOAA SWPC](https://www.swpc.noaa.gov/products/planetary-k-index) | 3-day planetary K index forecast | none |
| [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) | Turning a typed town into coordinates | none |
| [DarkSky International](https://darksky.org/what-we-do/international-dark-sky-places/all-places/) | Certified Dark Sky Parks and Communities in and around Colorado | — |

No account, no server, no analytics, no API key. Preferences live in
`localStorage` and can be exported to JSON and imported on another device.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # astronomy, engine and service parsers (vitest)
npm run typecheck
npm run build      # -> dist/, static, deploys anywhere as-is
npm run icons      # regenerate the PNG icons from scripts/icons.mjs
```

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
`main`. Feature branches run the tests and build without deploying.

## How it is put together

```
src/
  core/
    astro/         Pure astronomy. No React, no network, fully tested.
      julian.ts      JD, sidereal time, obliquity, ΔT
      coords.ts      ecliptic ↔ equatorial ↔ horizontal, compass points
      sun.ts         apparent solar position, twilight thresholds
      moon.ts        Meeus ch. 47 tables, illumination, phase, next phase
      planets.ts     JPL Keplerian elements, geocentric RA/Dec
      galactic.ts    Sgr A* and a few bright anchors
      events.ts      the threshold-crossing solver; sun and moon times
    engine/
      night.ts       the Night model: samples, windows, planets, showers
      score.ts       best window, score, tier, reasons with provenance
      plan.ts        leave / arrive / window / home
      calendar.ts    45 nights of moon-free dark, next dark weekend
    forecast.ts    HourForecast, interpolation
    time.ts        wall-clock helpers (Intl only, no library)
    types.ts       Measure, Source, Confidence
  data/
    sites.ts       Colorado dark-sky sites, each with sources and a checked date
    showers.ts     IMO shower catalogue
  services/      Open-Meteo, OSRM, SWPC, geocoding; keyless, cached, labelled
  store/         Preferences (localStorage) and the night-data hook
  screens/       Tonight, Sites, Week (Later), Sky, More
  components/    NightStrip (SVG), Reasons, Tag, PlaceSearch, Sources
tests/unit/      astro, engine, services
```

## What it is not

LOOKUP is not a safety tool and never says "safe". Site coordinates are
representative points, not instructions on where to stand. Access, hours,
fees, road conditions and closures change; every site card links to
directions and lists what was known when the record was checked. Check before
you drive.
