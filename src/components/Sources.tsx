import type { Source } from '../core/types';

export function Sources({ list }: { list: Source[] }) {
  const seen = new Set<string>();
  const uniq = list.filter((s) => (seen.has(s.label) ? false : (seen.add(s.label), true)));
  return (
    <ul className="srcs">
      {uniq.map((s, i) => (
        <li key={i}>
          {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}
          {s.checked ? ` · checked ${s.checked}` : ''} · {s.confidence}
        </li>
      ))}
    </ul>
  );
}
