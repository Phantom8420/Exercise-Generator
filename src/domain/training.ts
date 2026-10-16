import type { Exercise, Goal, Intensity, Level, Muscle } from './types';

export interface GoalParams {
  repMin: number;
  repMax: number;
  restS: number;
  setsPerExercise: number;
}

/** Goal drives rep range, rest and per-exercise sets. */
export const GOAL_PARAMS: Record<Goal, GoalParams> = {
  strength: { repMin: 3, repMax: 6, restS: 180, setsPerExercise: 4 },
  gain_muscle: { repMin: 8, repMax: 12, restS: 90, setsPerExercise: 3 },
  lose_fat: { repMin: 10, repMax: 15, restS: 60, setsPerExercise: 3 },
  maintain: { repMin: 8, repMax: 12, restS: 90, setsPerExercise: 2 },
  recomp: { repMin: 6, repMax: 10, restS: 120, setsPerExercise: 3 },
};

export const INTENSITY_SET_FACTOR: Record<Intensity, number> = {
  low: 0.75,
  moderate: 1,
  high: 1.34,
  extreme: 1.67,
};

const SECONDS_PER_REP = 3;

/** Wall-clock seconds for one set including its rest. */
export function setSeconds(repMin: number, repMax: number, restS: number): number {
  return ((repMin + repMax) / 2) * SECONDS_PER_REP + restS;
}

export const LEVEL_WEIGHT: Record<Level, number> = { beginner: 1, intermediate: 1.25, expert: 1.5 };

/** Muscles the generators program for. Small stabilisers get hit indirectly. */
export const TRAINABLE: Muscle[] = [
  'chest', 'lats', 'middle back', 'shoulders', 'biceps', 'triceps',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'traps',
];

const TRAINING_CATEGORIES = new Set(['strength', 'powerlifting']);

export function trainingPool(exercises: Exercise[], available: ReadonlySet<string>): Exercise[] {
  return exercises.filter(
    (e) => TRAINING_CATEGORIES.has(e.category) && (e.equipment === 'body only' || available.has(e.equipment)),
  );
}

/** Ranks exercises for a muscle: compounds first, then level close to the user's, then name for stability. */
export function rankFor(muscle: Muscle, pool: Exercise[], preferLevel: Level): Exercise[] {
  const lw = LEVEL_WEIGHT[preferLevel];
  return pool
    .filter((e) => e.primary[0] === muscle)
    .sort((a, b) => {
      const mc = Number(b.mechanic === 'compound') - Number(a.mechanic === 'compound');
      if (mc) return mc;
      const ld = Math.abs(LEVEL_WEIGHT[a.level] - lw) - Math.abs(LEVEL_WEIGHT[b.level] - lw);
      if (ld) return ld;
      return a.name.localeCompare(b.name);
    });
}

export function experienceLevel(exp: 'beginner' | 'intermediate' | 'advanced'): Level {
  return exp === 'advanced' ? 'expert' : exp;
}
