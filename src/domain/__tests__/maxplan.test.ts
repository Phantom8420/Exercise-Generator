import { gapHours, limitsFor, maxPlan, type MaxPlanInput } from '../maxplan';
import { GOAL_PARAMS, setSeconds } from '../training';
import { library } from './fixtures';

const lib = library();
const input: MaxPlanInput = {
  weekdays: [0, 1, 2, 3, 4],
  minutesPerSession: 60,
  equipment: ['barbell', 'dumbbell'],
  goal: 'gain_muscle',
  experience: 'intermediate',
  recovery: 3,
  respectRecovery: true,
};

describe('maxPlan', () => {
  it('gap hours wrap around the week', () => {
    expect(gapHours(0, 6)).toBe(24);
    expect(gapHours(1, 4)).toBe(72);
  });

  it('never violates recovery constraints', () => {
    for (const recovery of [1, 3, 5]) {
      for (const minutes of [30, 90, 240]) {
        const res = maxPlan({ ...input, recovery, minutesPerSession: minutes }, lib);
        const limits = limitsFor('intermediate', recovery);
        for (const w of res.explanation.weekly) {
          expect(w.sets).toBeLessThanOrEqual(limits.weeklyCap);
          if (w.minGapHours != null) expect(w.minGapHours).toBeGreaterThanOrEqual(48);
        }
        for (const day of Object.values(res.grid)) for (const v of Object.values(day)) expect(v).toBeLessThanOrEqual(limits.sessionCap);
      }
    }
  });

  it('never exceeds session time', () => {
    const p = GOAL_PARAMS.gain_muscle;
    const per = setSeconds(p.repMin, p.repMax, p.restS);
    const res = maxPlan({ ...input, respectRecovery: false, minutesPerSession: 45 }, lib);
    for (const d of res.explanation.days) expect(d.sets * per).toBeLessThanOrEqual(45 * 60);
  });

  it('ignoring recovery fills all available time', () => {
    const p = GOAL_PARAMS.gain_muscle;
    const per = setSeconds(p.repMin, p.repMax, p.restS);
    const res = maxPlan({ ...input, respectRecovery: false }, lib);
    expect(res.explanation.totalSets).toBe(5 * Math.floor((60 * 60) / per));
    expect(res.explanation.days.every((d) => d.binding === 'time')).toBe(true);
  });

  it('time-bound plans stay balanced across muscles', () => {
    const res = maxPlan({ ...input, respectRecovery: false }, lib);
    const sets = res.explanation.weekly.map((w) => w.sets);
    expect(Math.max(...sets) - Math.min(...sets)).toBeLessThanOrEqual(1);
  });

  it('more recovery capacity → at least as much volume', () => {
    const lo = maxPlan({ ...input, recovery: 1, minutesPerSession: 240 }, lib).explanation.totalSets;
    const hi = maxPlan({ ...input, recovery: 5, minutesPerSession: 240 }, lib).explanation.totalSets;
    expect(hi).toBeGreaterThanOrEqual(lo);
  });

  it('is deterministic and produces exercises matching the grid', () => {
    const a = maxPlan(input, lib);
    expect(maxPlan(input, lib)).toEqual(a);
    const gridSets = Object.values(a.grid).reduce((s, d) => s + Object.values(d).reduce((t, v) => t + (v ?? 0), 0), 0);
    const exSets = a.days.reduce((s, d) => s + d.exercises.reduce((t, e) => t + e.sets, 0), 0);
    expect(exSets).toBe(gridSets);
  });
});
