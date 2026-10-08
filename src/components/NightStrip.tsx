import type { Night } from '../core/engine/night';
import type { BestWindow } from '../core/engine/score';
import { fmtTime, localParts } from '../core/time';

/**
 * The whole night on one strip: twilight → dark → twilight, the Moon's path
 * shaded by how bright it is, the Milky Way core, cloud cover by hour, and the
 * chosen window. Drawn with CSS variables so red mode applies to it too.
 */
export function NightStrip({ night, window: win, now }: { night: Night; window: BestWindow | null; now: number }) {
  const W = 560, H = 190;
  const padL = 8, padR = 8, top = 26, bottom = 34;
  const plotH = H - top - bottom;
  const { start, end } = night.span;
  const x = (t: number) => padL + ((t - start) / (end - start)) * (W - padL - padR);
  const yAlt = (alt: number) => top + plotH - (Math.max(0, Math.min(90, alt)) / 90) * plotH;
  const tz = night.timezone;

  // Twilight bands from the samples: sun altitude → opacity.
  const bands = night.samples.map((s, i) => {
    const next = night.samples[i + 1]?.t ?? end;
    const depth = Math.max(0, Math.min(1, -s.sunAlt / 18)); // 0 at horizon, 1 at −18
    return { x0: x(s.t), x1: x(next), depth };
  });

  const moonPath = (() => {
    let d = '';
    let pen = false;
    for (const s of night.samples) {
      if (s.moonAlt < -2) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(s.t).toFixed(1)},${yAlt(s.moonAlt).toFixed(1)} `;
      pen = true;
    }
    return d;
  })();
  const mwPath = (() => {
    let d = '';
    let pen = false;
    for (const s of night.samples) {
      if (s.galacticAlt < -2) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(s.t).toFixed(1)},${yAlt(s.galacticAlt).toFixed(1)} `;
      pen = true;
    }
    return d;
  })();

  // Hour ticks.
  const ticks: number[] = [];
  {
    const p = localParts(start, tz);
    let t = start + ((60 - p.minute) % 60) * 60_000 - p.second * 1000;
    for (; t <= end; t += 3600_000) ticks.push(t);
  }
  const hasClouds = night.hasForecast;

  return (
    <svg className="strip" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The night at a glance: twilight, Moon, Milky Way core, cloud cover and your window.">
      {/* sky background by darkness */}
      {bands.map((b, i) => (
        <rect key={i} x={b.x0} y={top} width={Math.max(0.5, b.x1 - b.x0 + 0.5)} height={plotH} fill="var(--bg-2)" opacity={0.35 + 0.65 * b.depth} />
      ))}
      {bands.map((b, i) => (b.depth < 1 ? <rect key={`t${i}`} x={b.x0} y={top} width={Math.max(0.5, b.x1 - b.x0 + 0.5)} height={plotH} fill="var(--accent)" opacity={(1 - b.depth) * 0.18} /> : null))}
      {/* clouds: bars along the bottom of the plot, height = cover */}
      {hasClouds &&
        night.samples.map((s, i) => {
          if (s.cloud == null) return null;
          const next = night.samples[i + 1]?.t ?? end;
          const h = (s.cloud / 100) * plotH * 0.6;
          return <rect key={`c${i}`} x={x(s.t)} y={top + plotH - h} width={Math.max(0.5, x(next) - x(s.t) + 0.5)} height={h} fill="var(--cloud)" opacity={0.55} />;
        })}
      {/* window */}
      {win && (
        <g>
          <rect x={x(win.start)} y={top - 4} width={x(win.end) - x(win.start)} height={plotH + 8} fill="none" stroke="var(--accent)" strokeWidth={2} rx={4} />
          <text x={Math.max(110, Math.min(W - 110, (x(win.start) + x(win.end)) / 2))} y={top - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--accent)" fontFamily="var(--font-display)" letterSpacing={1}>
            YOUR WINDOW · {fmtTime(win.start, tz).toUpperCase()}–{fmtTime(win.end, tz).toUpperCase()}
          </text>
        </g>
      )}
      {/* Milky Way core */}
      <path d={mwPath} fill="none" stroke="var(--mw)" strokeWidth={2} strokeDasharray="4 3" />
      {/* Moon path, opacity by illumination */}
      <path d={moonPath} fill="none" stroke="var(--moon)" strokeWidth={3} opacity={0.25 + 0.75 * night.moon.illumination} strokeLinecap="round" />
      {/* horizon */}
      <line x1={padL} x2={W - padR} y1={top + plotH} y2={top + plotH} stroke="var(--line)" />
      {/* ticks */}
      {ticks.map((t) => {
        const p = localParts(t, tz);
        const label = p.hour % 3 === 0 ? (p.hour === 0 ? '12a' : p.hour === 12 ? '12p' : p.hour < 12 ? `${p.hour}a` : `${p.hour - 12}p`) : null;
        return (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top + plotH} y2={top + plotH + (label ? 6 : 3)} stroke="var(--ink-3)" />
            {label && (
              <text x={x(t)} y={top + plotH + 18} textAnchor="middle" fontSize={11} fill="var(--ink-3)" fontFamily="var(--font-body)">
                {label}
              </text>
            )}
          </g>
        );
      })}
      {/* sunset / sunrise labels */}
      <text x={padL} y={H - 4} fontSize={11} fill="var(--ink-3)" fontFamily="var(--font-body)">set {fmtTime(start, tz)}</text>
      <text x={W - padR} y={H - 4} fontSize={11} fill="var(--ink-3)" textAnchor="end" fontFamily="var(--font-body)">rise {fmtTime(end, tz)}</text>
      {/* now */}
      {now > start && now < end && (
        <g>
          <line x1={x(now)} x2={x(now)} y1={top - 4} y2={top + plotH} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="2 3" />
          {/* Inside the window the window label owns the top edge, so NOW sits at the foot of the line. */}
          <text x={x(now) + 4} y={win && now >= win.start && now <= win.end ? top + plotH - 6 : top - 9} textAnchor={win && now >= win.start && now <= win.end ? 'start' : 'middle'} fontSize={10} fill="var(--ink)" fontFamily="var(--font-display)" fontWeight={700}>NOW</text>
        </g>
      )}
    </svg>
  );
}
