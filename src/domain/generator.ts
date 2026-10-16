import { rng } from './rng';
import { GOAL_PARAMS, INTENSITY_SET_FACTOR, experienceLevel, rankFor, setSeconds, trainingPool } from './training';
import type { Exercise, Experience, Goal, Intensity, Muscle, PlannedDay, PlannedExercise, Split } from './types';

export interface DayInput {
  weekday: number;
  intensity: Intensity;
  minutes: number;
  /** Required for split 'custom', optional override otherwise. */
  muscles?: Muscle[];
}

export interface GeneratorInput {
  split: Split;
  goal: Goal;
  experience: Experience;
  equipment: string[];
  days: DayInput[];
  seed: number;
}

const UPPER: Muscle[] = ['chest', 'lats', 'shoulders', 'middle back', 'triceps', 'biceps'];
const LOWER: Muscle[] = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals'];
const PUSH: Muscle[] = ['chest', 'shoulders', 'triceps'];
const PULL: Muscle[] = ['lats', 'middle back', 'biceps', 'traps'];
const LEGS: Muscle[] = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals'];
const FULL: Muscle[] = ['quadriceps', 'chest', 'lats', 'hamstrings', 'shoulders', 'middle back', 'glutes', 'triceps', 'biceps', 'calves', 'abdominals'];

const SPLIT_CYCLE: Record<Exclude<Split, 'custom'>, { label: string; muscles: Muscle[] }[]> = {
  full_body: [{ label: 'Full Body', muscles: FULL }],
  upper_lower: [
    { label: 'Upper', muscles: UPPER },
    { label: 'Lower', muscles: LOWER },
  ],
  ppl: [
    { label: 'Push', muscles: PUSH },
    { label: 'Pull', muscles: PULL },
    { label: 'Legs', muscles: LEGS },
  ],
  bro: [
    { label: 'Chest', muscles: ['chest', 'triceps'] },
    { label: 'Back', muscles: ['lats', 'middle back', 'traps'] },
    { label: 'Legs', muscles: LEGS },
    { label: 'Shoulders', muscles: ['shoulders', 'traps', 'abdominals'] },
    { label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  ],
};

export function dayTemplates(split: Split, days: DayInput[]): { label: string; muscles: Muscle[] }[] {
  const sorted = [...days].sort((a, b) => a.weekday - b.weekday);
  return sorted.map((d, i) => {
    if (split === 'custom' || d.muscles?.length) {
      return { label: d.muscles?.length ? 'Custom' : 'Rest', muscles: d.muscles ?? [] };
    }
    const cycle = SPLIT_CYCLE[split];
    return cycle[i % cycle.length];
  });
}

/**
 * Fills each day round-robin over its muscles, best-ranked exercise first, until the
 * session's time budget is used. Deterministic for a given seed.
 */
export function generateRoutine(input: GeneratorInput, exercises: Exercise[]): PlannedDay[] {
  const params = GOAL_PARAMS[input.goal];
  const pool = trainingPool(exercises, new Set(input.equipment));
  const level = experienceLevel(input.experience);
  const random = rng(input.seed);
  const sortedDays = [...input.days].sort((a, b) => a.weekday - b.weekday);
  const templates = dayTemplates(input.split, sortedDays);

  return sortedDays.map((day, i) => {
    const { label, muscles } = templates[i];
    const sets = Math.max(1, Math.round(params.setsPerExercise * INTENSITY_SET_FACTOR[day.intensity]));
    const perSet = setSeconds(params.repMin, params.repMax, params.restS);
    let remaining = day.minutes * 60;

    // Per-muscle candidate queues; the seed rotates among the top few so regenerate gives variety.
    const queues = new Map<Muscle, Exercise[]>();
    for (const m of muscles) {
      const ranked = rankFor(m, pool, level);
      const top = Math.min(3, ranked.length);
      const shift = top ? Math.floor(random() * top) : 0;
      queues.set(m, [...ranked.slice(shift, top), ...ranked.slice(0, shift), ...ranked.slice(top)]);
    }

    const used = new Set<string>();
    const planned: PlannedExercise[] = [];
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const m of muscles) {
        const fit = Math.min(sets, Math.floor(remaining / perSet));
        if (fit < 1) break;
        const q = queues.get(m)!;
        while (q.length && used.has(q[0].id)) q.shift();
        const ex = q.shift();
        if (!ex) continue;
        used.add(ex.id);
        planned.push({ exerciseId: ex.id, sets: fit, repMin: params.repMin, repMax: params.repMax, restS: params.restS });
        remaining -= fit * perSet;
        progressed = true;
      }
    }
    return { weekday: day.weekday, label, intensity: day.intensity, minutes: day.minutes, muscles, exercises: planned };
  });
}

export function estimatedMinutes(exercises: PlannedExercise[]): number {
  return Math.round(exercises.reduce((s, e) => s + e.sets * setSeconds(e.repMin, e.repMax, e.restS), 0) / 60);
}
