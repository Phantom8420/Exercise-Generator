import type { Exercise, Muscle } from '../types';

let n = 0;
export function ex(partial: Partial<Exercise> & { primary: Muscle[] }): Exercise {
  n++;
  return {
    id: partial.id ?? `ex${n}`,
    name: partial.name ?? `Exercise ${n}`,
    secondary: [],
    equipment: 'body only',
    mechanic: 'compound',
    force: 'push',
    level: 'beginner',
    category: 'strength',
    instructions: [],
    mistakes: [],
    images: [],
    ...partial,
  };
}

/** Two exercises (one compound, one isolation) per trainable muscle, mixed equipment. */
export function library(): Exercise[] {
  const muscles: Muscle[] = ['chest', 'lats', 'middle back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'traps'];
  return muscles.flatMap((m) => [
    ex({ id: `${m}-bb`, name: `${m} barbell`, primary: [m], equipment: 'barbell', mechanic: 'compound' }),
    ex({ id: `${m}-bw`, name: `${m} bodyweight`, primary: [m], equipment: 'body only', mechanic: 'isolation' }),
    ex({ id: `${m}-db`, name: `${m} dumbbell`, primary: [m], equipment: 'dumbbell', mechanic: 'isolation', level: 'intermediate' }),
  ]);
}
