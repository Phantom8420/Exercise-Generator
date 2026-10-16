import type { PlannedExercise } from './types';

export type DebtMetric = 'reps' | 'volume';

/** Loaded exercises with a target weight owe volume (kg); everything else owes reps. */
export function debtMetric(p: PlannedExercise): DebtMetric {
  return p.targetWeightKg && p.targetWeightKg > 0 ? 'volume' : 'reps';
}

/** Planned amount for one prescribed exercise, using the top of the rep range. */
export function plannedAmount(p: PlannedExercise): number {
  const reps = p.sets * p.repMax;
  return debtMetric(p) === 'volume' ? reps * (p.targetWeightKg ?? 0) : reps;
}

/** What was missed, given the sets actually logged for that exercise that day. */
export function missedAmount(p: PlannedExercise, logged: { weightKg: number; reps: number }[]): number {
  const metric = debtMetric(p);
  const done = logged.reduce((s, l) => s + (metric === 'volume' ? l.weightKg * l.reps : l.reps), 0);
  return Math.max(0, plannedAmount(p) - done);
}

export const DEFAULT_CAP_FRACTION = 0.25;

export interface UpcomingDay {
  date: string;
  /** Planned amount (same metric) for the debt's muscle on that day; 0 = muscle not trained. */
  plannedForMuscle: number;
}

export interface Allocation {
  date: string;
  amount: number;
}

/**
 * Spreads the remaining debt across upcoming days that train the muscle.
 * cap: undefined → default 25% of that day's planned amount; number → absolute per-day cap;
 * null → no cap (everything lands on the first eligible day).
 */
export function scheduleRepayment(
  remaining: number,
  upcoming: UpcomingDay[],
  cap?: number | null,
): { allocations: Allocation[]; unscheduled: number } {
  const allocations: Allocation[] = [];
  let left = remaining;
  for (const day of upcoming) {
    if (left <= 0) break;
    if (day.plannedForMuscle <= 0 && cap === undefined) continue;
    const limit = cap === null ? left : cap === undefined ? Math.ceil(day.plannedForMuscle * DEFAULT_CAP_FRACTION) : cap;
    const amount = Math.min(left, limit);
    if (amount > 0) {
      allocations.push({ date: day.date, amount });
      left -= amount;
    }
  }
  return { allocations, unscheduled: left };
}

/** Amount of debt cleared by doing `done` units of an exercise with the given equivalence factor. */
export function repaidBy(done: number, factor: number): number {
  return done * factor;
}

export function applyRepayment(owed: number, repaid: number, amount: number): { repaid: number; cleared: boolean } {
  const next = Math.min(owed, repaid + amount);
  return { repaid: next, cleared: next >= owed };
}
