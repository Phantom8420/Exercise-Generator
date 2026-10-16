import { GOAL_PARAMS, TRAINABLE, experienceLevel, rankFor, setSeconds, trainingPool } from './training';
import type { Exercise, Experience, Goal, Muscle, PlannedDay, PlannedExercise } from './types';

export interface MaxPlanInput {
  weekdays: number[]; // 0 = Monday
  minutesPerSession: number;
  equipment: string[];
  goal: Goal;
  experience: Experience;
  /** 1 (busy, poor sleep) … 5 (lots of recovery capacity) */
  recovery: number;
  respectRecovery: boolean;
}

export interface Limits {
  weeklyCap: number;
  sessionCap: number;
  minGapHours: number;
}

const BASE_WEEKLY: Record<Experience, number> = { beginner: 12, intermediate: 18, advanced: 24 };
const BASE_SESSION: Record<Experience, number> = { beginner: 6, intermediate: 8, advanced: 10 };

/** Recovery rating scales the per-muscle caps from 0.6× (1) to 1.4× (5). */
export function limitsFor(experience: Experience, recovery: number): Limits {
  const scale = 0.6 + 0.2 * (Math.min(5, Math.max(1, recovery)) - 1);
  return {
    weeklyCap: Math.round(BASE_WEEKLY[experience] * scale),
    sessionCap: Math.max(1, Math.round(BASE_SESSION[experience] * scale)),
    minGapHours: 48,
  };
}

/** Smallest hours between two weekdays on a repeating week. */
export function gapHours(a: number, b: number): number {
  const d = Math.abs(a - b) % 7;
  return Math.min(d, 7 - d) * 24;
}

export type Grid = Record<number, Partial<Record<Muscle, number>>>;

export interface Explanation {
  totalSets: number;
  weekly: { muscle: Muscle; sets: number; cap: number | null; days: number[]; minGapHours: number | null }[];
  days: { weekday: number; sets: number; minutesUsed: number; binding: 'time' | 'recovery' | 'none' }[];
  score: { total: number; imbalance: number; formula: string };
  limits: Limits | null;
}

export interface MaxPlanResult {
  grid: Grid;
  days: PlannedDay[];
  explanation: Explanation;
}

/**
 * Score is lexicographic: maximise total weekly sets, then minimise imbalance
 * (variance of weekly sets across muscles). Every set costs the same time, so greedy
 * filling never loses total sets; the balance tie-break picks which muscle gets each set.
 */
export function score(grid: Grid, muscles: Muscle[]): { total: number; imbalance: number } {
  const weekly = muscles.map((m) => Object.values(grid).reduce((s, d) => s + (d[m] ?? 0), 0));
  const total = weekly.reduce((s, v) => s + v, 0);
  const mean = total / muscles.length;
  const imbalance = weekly.reduce((s, v) => s + (v - mean) ** 2, 0) / muscles.length;
  return { total, imbalance };
}

export function feasible(
  grid: Grid,
  weekday: number,
  m: Muscle,
  secondsLeft: Record<number, number>,
  perSet: number,
  limits: Limits | null,
): boolean {
  if (secondsLeft[weekday] < perSet) return false;
  if (!limits) return true;
  const day = grid[weekday] ?? {};
  if ((day[m] ?? 0) >= limits.sessionCap) return false;
  const weekly = Object.values(grid).reduce((s, d) => s + (d[m] ?? 0), 0);
  if (weekly >= limits.weeklyCap) return false;
  if (!day[m]) {
    for (const [wd, d] of Object.entries(grid)) {
      if (Number(wd) !== weekday && (d[m] ?? 0) > 0 && gapHours(Number(wd), weekday) < limits.minGapHours) return false;
    }
  }
  return true;
}

export function solveGrid(input: MaxPlanInput, muscles: Muscle[]): Grid {
  const p = GOAL_PARAMS[input.goal];
  const perSet = setSeconds(p.repMin, p.repMax, p.restS);
  const limits = input.respectRecovery ? limitsFor(input.experience, input.recovery) : null;
  const days = [...new Set(input.weekdays)].sort((a, b) => a - b);
  const grid: Grid = {};
  const secondsLeft: Record<number, number> = {};
  for (const d of days) {
    grid[d] = {};
    secondsLeft[d] = input.minutesPerSession * 60;
  }
  const weekly = (m: Muscle) => days.reduce((s, d) => s + (grid[d][m] ?? 0), 0);

  // Greedy: each step adds one set where it keeps muscles most balanced.
  for (;;) {
    let best: { d: number; m: Muscle; key: number[] } | null = null;
    for (const m of muscles) {
      const w = weekly(m);
      for (const d of days) {
        if (!feasible(grid, d, m, secondsLeft, perSet, limits)) continue;
        // Lower is better: weekly sets, then prefer days already hitting m (keeps gap slots free), then most time left.
        const key = [w, grid[d][m] ? 0 : 1, -secondsLeft[d], d];
        if (!best || lexLess(key, best.key)) best = { d, m, key };
      }
    }
    if (!best) break;
    grid[best.d][best.m] = (grid[best.d][best.m] ?? 0) + 1;
    secondsLeft[best.d] -= perSet;
  }
  return grid;
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** Turns per-muscle set counts into exercises: up to 4 sets per exercise, best-ranked first. */
export function toDays(grid: Grid, input: MaxPlanInput, pool: Exercise[]): PlannedDay[] {
  const p = GOAL_PARAMS[input.goal];
  const level = experienceLevel(input.experience);
  return Object.entries(grid)
    .map(([wd, sets]) => {
      const exercises: PlannedExercise[] = [];
      const muscles = Object.keys(sets).filter((m) => (sets[m as Muscle] ?? 0) > 0) as Muscle[];
      for (const m of muscles) {
        const ranked = rankFor(m, pool, level);
        let left = sets[m] ?? 0;
        let i = 0;
        while (left > 0 && ranked.length) {
          const n = Math.min(4, left);
          exercises.push({ exerciseId: ranked[i % ranked.length].id, sets: n, repMin: p.repMin, repMax: p.repMax, restS: p.restS });
          left -= n;
          i++;
        }
      }
      return {
        weekday: Number(wd),
        label: 'Max',
        intensity: 'extreme' as const,
        minutes: input.minutesPerSession,
        muscles,
        exercises,
      };
    })
    .sort((a, b) => a.weekday - b.weekday);
}

export function maxPlan(input: MaxPlanInput, exercises: Exercise[]): MaxPlanResult {
  const pool = trainingPool(exercises, new Set(input.equipment));
  // Only program muscles the equipment can actually train.
  const muscles = TRAINABLE.filter((m) => pool.some((e) => e.primary[0] === m));
  const grid = solveGrid(input, muscles);
  const limits = input.respectRecovery ? limitsFor(input.experience, input.recovery) : null;
  const p = GOAL_PARAMS[input.goal];
  const perSet = setSeconds(p.repMin, p.repMax, p.restS);
  const s = score(grid, muscles);

  const dayKeys = Object.keys(grid).map(Number);
  const weekly = muscles.map((m) => {
    const days = dayKeys.filter((d) => (grid[d][m] ?? 0) > 0);
    let minGap: number | null = null;
    for (let i = 0; i < days.length; i++)
      for (let j = i + 1; j < days.length; j++) {
        const g = gapHours(days[i], days[j]);
        minGap = minGap == null ? g : Math.min(minGap, g);
      }
    return { muscle: m, sets: dayKeys.reduce((t, d) => t + (grid[d][m] ?? 0), 0), cap: limits?.weeklyCap ?? null, days, minGapHours: minGap };
  });
  const daysExpl = dayKeys.map((d) => {
    const sets = Object.values(grid[d]).reduce((t, v) => t + (v ?? 0), 0);
    const left = input.minutesPerSession * 60 - sets * perSet;
    return {
      weekday: d,
      sets,
      minutesUsed: Math.round((sets * perSet) / 60),
      binding: left < perSet ? ('time' as const) : limits ? ('recovery' as const) : ('none' as const),
    };
  });

  return {
    grid,
    days: toDays(grid, input, pool),
    explanation: {
      totalSets: s.total,
      weekly,
      days: daysExpl,
      score: { ...s, formula: 'maximise Σ weekly sets; tie-break: minimise variance of sets per muscle' },
      limits,
    },
  };
}
