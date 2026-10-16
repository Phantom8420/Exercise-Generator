import { parseDay } from '../domain/dates';
import type { ChallengeKind } from '../domain/challenges';
import type { DebtMetric } from '../domain/debt';
import { displayWeight, formatNumber, weightUnit } from '../domain/units';
import { useApp } from '../state/app';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtDate(day: string): string {
  const d = parseDay(day);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Weight and volume formatting bound to the user's unit setting. */
export function useUnits() {
  const units = useApp((s) => s.units);
  const w = weightUnit(units);
  return {
    units,
    w,
    weight: (kg: number) => `${displayWeight(kg, units)} ${w}`,
    volume: (kg: number) => `${formatNumber(displayWeight(kg, units))} ${w}`,
    amount: (v: number, metric: DebtMetric) => (metric === 'reps' ? `${formatNumber(v)} reps` : `${formatNumber(displayWeight(v, units))} ${w}`),
    challenge: (v: number, kind: ChallengeKind) =>
      kind === 'volume' ? `${formatNumber(displayWeight(v, units))} ${w}` : kind === 'reps' ? `${formatNumber(Math.round(v))} reps` : `${Math.round(v)} ${Math.round(v) === 1 ? 'day' : 'days'}`,
  };
}

export const KIND_ICON = { volume: 'bar-chart-2', reps: 'repeat', calories: 'pie-chart', streak: 'zap' } as const;
export const KIND_LABEL: Record<ChallengeKind, string> = { volume: 'Volume', reps: 'Reps', calories: 'Calories', streak: 'Streak' };
