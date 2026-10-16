export const MUSCLES = [
  'chest', 'lats', 'middle back', 'lower back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abdominals', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'neck',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  'body only', 'barbell', 'dumbbell', 'cable', 'machine', 'kettlebells', 'bands', 'e-z curl bar',
  'medicine ball', 'exercise ball', 'foam roll', 'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export type Level = 'beginner' | 'intermediate' | 'expert';
export type Mechanic = 'compound' | 'isolation';
export type Force = 'push' | 'pull' | 'static';

export type Goal = 'lose_fat' | 'gain_muscle' | 'strength' | 'maintain' | 'recomp';
export type Intensity = 'low' | 'moderate' | 'high' | 'extreme';
export type Split = 'upper_lower' | 'ppl' | 'full_body' | 'bro' | 'custom';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Sex = 'male' | 'female';

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment;
  mechanic: Mechanic | null;
  force: Force | null;
  level: Level;
  category: string;
  instructions: string[];
  mistakes: string[];
  images: string[];
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restS: number;
  targetWeightKg?: number | null;
}

export interface PlannedDay {
  weekday: number; // 0 = Monday … 6 = Sunday
  label: string;
  intensity: Intensity;
  minutes: number;
  muscles: Muscle[];
  exercises: PlannedExercise[];
}

export interface LoggedSetLike {
  exerciseId: string;
  weightKg: number;
  reps: number;
  date: string; // YYYY-MM-DD
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const GOAL_LABEL: Record<Goal, string> = {
  lose_fat: 'Lose fat',
  gain_muscle: 'Gain muscle',
  strength: 'Get stronger',
  maintain: 'Maintain',
  recomp: 'Recomp',
};

export const SPLIT_LABEL: Record<Split, string> = {
  upper_lower: 'Upper / Lower',
  ppl: 'Push Pull Legs',
  full_body: 'Full Body',
  bro: 'Bro Split',
  custom: 'Custom',
};
