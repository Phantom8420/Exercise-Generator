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

/** Well-known lifts, best first; they outrank the long tail of variations in the dataset. */
const STAPLES = new Map(
  [
    'Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Bench_Press', 'Incline_Dumbbell_Press',
    'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Pushups', 'Dips_-_Chest_Version', 'Cable_Crossover',
    'Dumbbell_Flyes', 'Barbell_Squat', 'Leg_Press', 'Front_Squat_Clean_Grip', 'Goblet_Squat', 'Dumbbell_Lunges',
    'Barbell_Lunge', 'Dumbbell_Step_Ups', 'Bodyweight_Squat', 'Bodyweight_Walking_Lunge', 'Leg_Extensions',
    'Romanian_Deadlift', 'Stiff-Legged_Barbell_Deadlift', 'Lying_Leg_Curls', 'Good_Morning',
    'Barbell_Hip_Thrust', 'Barbell_Glute_Bridge', 'Barbell_Deadlift', 'Hyperextensions_Back_Extensions',
    'Standing_Calf_Raises', 'Seated_Calf_Raise', 'Standing_Dumbbell_Calf_Raise', 'Pullups', 'Chin-Up',
    'Wide-Grip_Lat_Pulldown', 'Bent_Over_Barbell_Row', 'One-Arm_Dumbbell_Row', 'Seated_Cable_Rows',
    'Inverted_Row', 'Standing_Military_Press', 'Seated_Dumbbell_Press', 'Dumbbell_Shoulder_Press',
    'Arnold_Dumbbell_Press', 'Side_Lateral_Raise', 'Face_Pull', 'Reverse_Flyes', 'Barbell_Curl',
    'Dumbbell_Bicep_Curl', 'Hammer_Curls', 'Preacher_Curl', 'Triceps_Pushdown', 'Dips_-_Triceps_Version',
    'Close-Grip_Barbell_Bench_Press', 'EZ-Bar_Skullcrusher', 'Lying_Triceps_Press', 'Barbell_Shrug',
    'Dumbbell_Shrug', 'Hanging_Leg_Raise', 'Plank', 'Crunches', 'Ab_Roller', 'Russian_Twist',
  ].map((id, i) => [id, i]),
);
const stapleRank = (e: Exercise) => STAPLES.get(e.id) ?? Infinity;

/** Ranks exercises for a muscle: staples first, then compounds, then level close to the user's, then name for stability. */
export function rankFor(muscle: Muscle, pool: Exercise[], preferLevel: Level): Exercise[] {
  const lw = LEVEL_WEIGHT[preferLevel];
  return pool
    .filter((e) => e.primary[0] === muscle)
    .sort((a, b) => {
      const st = stapleRank(a) - stapleRank(b);
      if (st) return st;
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
