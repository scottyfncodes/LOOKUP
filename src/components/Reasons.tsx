import type { Reason } from '../core/engine/score';
import { Tag } from './Tag';

export function Reasons({ reasons }: { reasons: Reason[] }) {
  return (
    <ul className="reasons">
      {reasons.map((r, i) => (
        <li key={i}>
          <i className={`mk ${r.effect}`} aria-hidden />
          <span>{r.text}</span>
          <Tag c={r.confidence} />
        </li>
      ))}
    </ul>
  );
}
