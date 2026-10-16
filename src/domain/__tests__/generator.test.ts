import { estimatedMinutes, generateRoutine } from '../generator';
import { equivalenceFactor, findSubstitutes } from '../substitutes';
import { rankFor } from '../training';
import { ex, library } from './fixtures';

const lib = library();

describe('generateRoutine', () => {
  const base = {
    goal: 'gain_muscle' as const,
    experience: 'intermediate' as const,
    equipment: ['barbell'],
    seed: 1,
  };

  it('uses only available equipment', () => {
    const days = generateRoutine({ ...base, split: 'full_body', days: [{ weekday: 0, intensity: 'moderate', minutes: 60 }] }, lib);
    const ids = days[0].exercises.map((e) => e.exerciseId);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => !id.endsWith('-db'))).toBe(true);
  });

  it('fits the time budget', () => {
    for (const minutes of [20, 45, 90]) {
      const [day] = generateRoutine({ ...base, split: 'full_body', days: [{ weekday: 0, intensity: 'high', minutes }] }, lib);
      expect(estimatedMinutes(day.exercises)).toBeLessThanOrEqual(minutes);
    }
  });

  it('follows the split cycle by weekday order', () => {
    const days = generateRoutine(
      { ...base, split: 'ppl', days: [4, 0, 2].map((weekday) => ({ weekday, intensity: 'moderate' as const, minutes: 45 })) },
      lib,
    );
    expect(days.map((d) => [d.weekday, d.label])).toEqual([[0, 'Push'], [2, 'Pull'], [4, 'Legs']]);
  });

  it('custom split uses the given muscles', () => {
    const [day] = generateRoutine(
      { ...base, split: 'custom', days: [{ weekday: 1, intensity: 'moderate', minutes: 30, muscles: ['calves'] }] },
      lib,
    );
    expect(day.exercises.every((e) => e.exerciseId.startsWith('calves'))).toBe(true);
  });

  it('is deterministic per seed', () => {
    const input = { ...base, split: 'upper_lower' as const, days: [{ weekday: 0, intensity: 'moderate' as const, minutes: 60 }] };
    expect(generateRoutine(input, lib)).toEqual(generateRoutine(input, lib));
  });

  it('extreme intensity programs more sets than low', () => {
    const run = (intensity: 'low' | 'extreme') =>
      generateRoutine({ ...base, split: 'full_body', days: [{ weekday: 0, intensity, minutes: 600 }] }, lib)[0].exercises[0].sets;
    expect(run('extreme')).toBeGreaterThan(run('low'));
  });

  it('strength goal uses low reps and long rest', () => {
    const [day] = generateRoutine({ ...base, goal: 'strength', split: 'full_body', days: [{ weekday: 0, intensity: 'moderate', minutes: 60 }] }, lib);
    expect(day.exercises[0]).toMatchObject({ repMin: 3, repMax: 6, restS: 180 });
  });
});

describe('substitutes', () => {
  it('same primary muscle, available equipment only', () => {
    const target = lib.find((e) => e.id === 'chest-bb')!;
    const subs = findSubstitutes(target, lib, new Set(['barbell']));
    expect(subs.map((s) => s.id)).toEqual(['chest-bw']);
  });

  it('equivalence factor scales by difficulty', () => {
    const a = ex({ primary: ['chest'], level: 'beginner' });
    const b = ex({ primary: ['chest'], level: 'expert' });
    expect(equivalenceFactor(a, a)).toBe(1);
    expect(equivalenceFactor(a, b)).toBe(1.5);
  });
});

it('ranks staple lifts above obscure variations', () => {
  const pool = [
    ex({ id: 'Barbell_Guillotine_Bench_Press', name: 'Barbell Guillotine Bench Press', primary: ['chest'] }),
    ex({ id: 'Dumbbell_Flyes', name: 'Dumbbell Flyes', primary: ['chest'], mechanic: 'isolation' }),
    ex({ id: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Barbell Bench Press', primary: ['chest'] }),
  ];
  expect(rankFor('chest', pool, 'beginner').map((e) => e.id)).toEqual(['Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Flyes', 'Barbell_Guillotine_Bench_Press']);
});
