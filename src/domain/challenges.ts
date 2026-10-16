import { addDays, daysBetween } from './dates';
import type { Exercise, LoggedSetLike, Muscle } from './types';

export type ChallengeKind = 'volume' | 'reps' | 'calories' | 'streak';

export interface ChallengeDef {
  kind: ChallengeKind;
  /** volume: kg; reps: reps; calories & streak: days */
  target: number;
  startDate: string;
  endDate: string;
  exerciseIds?: string[] | null;
  muscles?: Muscle[] | null;
  /** Bodyweight sets count as bodyweight × reps toward volume. */
  countBodyweight?: boolean;
  /** calories kind: daily kcal threshold and direction. */
  dailyKcal?: number | null;
  kcalMode?: 'at_least' | 'at_most' | null;
}

export function matchesFilter(def: ChallengeDef, ex: Pick<Exercise, 'id' | 'primary'> | undefined): boolean {
  if (def.exerciseIds?.length) return !!ex && def.exerciseIds.includes(ex.id);
  if (def.muscles?.length) return !!ex && ex.primary.some((m) => def.muscles!.includes(m));
  return true;
}

/** What one logged set contributes to a volume/reps challenge. */
export function setContribution(
  def: ChallengeDef,
  set: LoggedSetLike,
  ex: Pick<Exercise, 'id' | 'primary' | 'equipment'> | undefined,
  bodyweightKg: number | null,
): number {
  if (set.date < def.startDate || set.date > def.endDate) return 0;
  if (!matchesFilter(def, ex)) return 0;
  if (def.kind === 'reps') return set.reps;
  if (def.kind !== 'volume') return 0;
  const load = set.weightKg > 0 ? set.weightKg : def.countBodyweight && bodyweightKg ? bodyweightKg : 0;
  return load * set.reps;
}

/** Days within the window that satisfy the kcal rule. */
export function calorieDays(def: ChallengeDef, kcalByDay: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  if (def.dailyKcal == null) return out;
  for (const [day, kcal] of Object.entries(kcalByDay)) {
    if (day < def.startDate || day > def.endDate || kcal <= 0) continue;
    const ok = def.kcalMode === 'at_most' ? kcal <= def.dailyKcal : kcal >= def.dailyKcal;
    if (ok) out[day] = 1;
  }
  return out;
}

/** Consecutive trained days ending today (or yesterday, so a streak survives until today ends). */
export function currentStreak(trainedDays: Set<string>, todayStr: string, since: string): number {
  let d = trainedDays.has(todayStr) ? todayStr : addDays(todayStr, -1);
  let n = 0;
  while (d >= since && trainedDays.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface Progress {
  total: number;
  remaining: number;
  pct: number;
  daysLeft: number;
  requiredPerDay: number;
  ratePerDay: number;
  projectedFinish: string | null;
  done: boolean;
}

/**
 * amountByDay: daily totals inside the window (for streak, total is passed explicitly).
 * Rate is the trailing 7-day average (or since start if shorter); projection extrapolates it.
 */
export function progress(def: ChallengeDef, amountByDay: Record<string, number>, todayStr: string, totalOverride?: number): Progress {
  const total = totalOverride ?? Object.values(amountByDay).reduce((s, v) => s + v, 0);
  const remaining = Math.max(0, def.target - total);
  const daysLeft = Math.max(0, daysBetween(todayStr, def.endDate) + 1);
  const elapsed = Math.max(1, Math.min(7, daysBetween(def.startDate, todayStr) + 1));
  const windowStart = addDays(todayStr, -(elapsed - 1));
  let recent = 0;
  for (const [day, v] of Object.entries(amountByDay)) if (day >= windowStart && day <= todayStr) recent += v;
  const ratePerDay = recent / elapsed;
  const done = remaining === 0;
  return {
    total,
    remaining,
    pct: def.target > 0 ? Math.min(1, total / def.target) : 0,
    daysLeft,
    requiredPerDay: daysLeft > 0 ? remaining / daysLeft : remaining,
    ratePerDay,
    projectedFinish: done ? todayStr : ratePerDay > 0 ? addDays(todayStr, Math.ceil(remaining / ratePerDay)) : null,
    done,
  };
}
