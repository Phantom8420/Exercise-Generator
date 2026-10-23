import type { Goal, Sex } from './types';

export interface Result {
  value: number;
  formula: string;
}

export function bmi(weightKg: number, heightCm: number): Result {
  const m = heightCm / 100;
  return { value: weightKg / (m * m), formula: 'BMI = weight (kg) / height (m)²' };
}

/** US Navy circumference method, inputs in cm. Returns null when the log argument is not positive. */
export function navyBodyFat(
  sex: Sex,
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm?: number | null,
): Result | null {
  if (sex === 'male') {
    if (waistCm - neckCm <= 0) return null;
    return {
      value: 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450,
      formula: 'BF% = 495 / (1.0324 − 0.19077·log10(waist − neck) + 0.15456·log10(height)) − 450',
    };
  }
  if (hipCm == null || waistCm + hipCm - neckCm <= 0) return null;
  return {
    value: 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450,
    formula: 'BF% = 495 / (1.29579 − 0.35004·log10(waist + hip − neck) + 0.22100·log10(height)) − 450',
  };
}

export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): Result {
  const s = sex === 'male' ? 5 : -161;
  return {
    value: 10 * weightKg + 6.25 * heightCm - 5 * age + s,
    formula: `BMR = 10·kg + 6.25·cm − 5·age ${sex === 'male' ? '+ 5' : '− 161'}`,
  };
}

export const ACTIVITY = [
  { factor: 1.2, label: 'Sedentary' },
  { factor: 1.375, label: 'Light (1–3 days/wk)' },
  { factor: 1.55, label: 'Moderate (3–5 days/wk)' },
  { factor: 1.725, label: 'Hard (6–7 days/wk)' },
  { factor: 1.9, label: 'Very hard (physical job + training)' },
] as const;

export function tdee(bmrKcal: number, activityFactor: number): Result {
  return { value: bmrKcal * activityFactor, formula: `TDEE = BMR × ${activityFactor}` };
}

export function ageFrom(birthDate: string, on: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age--;
  return age;
}

/** Default weekly weight change as % of bodyweight per goal (Helms 2014, Iraki 2019); the user can set any value. */
export const DEFAULT_PACE_PCT_PER_WEEK: Record<Goal, number> = {
  lose_fat: -0.7,
  gain_muscle: 0.25,
  strength: 0.15,
  maintain: 0,
  recomp: -0.15,
};

/** Default pace in kg/week; without a weigh-in a 75 kg reference body is assumed. */
export function defaultPaceKg(goal: Goal, weightKg: number | null): number {
  return Math.round((weightKg ?? 75) * DEFAULT_PACE_PCT_PER_WEEK[goal] * 10) / 1000;
}

/** Protein g per kg bodyweight per goal. */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose_fat: 2.2,
  gain_muscle: 2.0,
  strength: 1.8,
  maintain: 1.6,
  recomp: 2.2,
};

const KCAL_PER_KG = 7700;

export function calorieTarget(tdeeKcal: number, paceKgPerWeek: number): Result {
  return {
    value: tdeeKcal + (paceKgPerWeek * KCAL_PER_KG) / 7,
    formula: `kcal = TDEE + pace (${paceKgPerWeek} kg/wk) × 7700 / 7`,
  };
}

export function proteinTarget(weightKg: number, goal: Goal): Result {
  const k = PROTEIN_G_PER_KG[goal];
  return { value: weightKg * k, formula: `protein = ${k} g × kg bodyweight` };
}

/** Trailing simple moving average; first window-1 points average what exists so far. */
export function movingAverage(values: number[], window = 7): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(sum / Math.min(i + 1, window));
  }
  return out;
}
