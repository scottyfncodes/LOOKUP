import type { Confidence } from '../core/types';

const LABEL: Record<Confidence, string> = {
  computed: 'computed',
  forecast: 'forecast',
  official: 'official',
  estimate: 'estimate',
  user: 'you entered',
};

export function Tag({ c }: { c: Confidence }) {
  return <span className={`tag ${c}`}>{LABEL[c]}</span>;
}
