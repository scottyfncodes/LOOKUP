import type { Score } from '../core/engine/score';

export function scoreText(s: Score): { main: string; sub: string | null } {
  if (s.value != null) return { main: s.value.toFixed(1), sub: null };
  return { main: s.ifClear.toFixed(1), sub: 'if clear' };
}

export function ScoreNum({ s, className = '' }: { s: Score; className?: string }) {
  const t = scoreText(s);
  return (
    <div className={`score t-${s.tier} ${className}`}>
      {t.main}
      {t.sub && <small> {t.sub}</small>}
    </div>
  );
}
