import { calorieDays, currentStreak, progress, setContribution, type ChallengeDef } from '../challenges';
import { applyRepayment, missedAmount, plannedAmount, repaidBy, scheduleRepayment } from '../debt';

const volume: ChallengeDef = { kind: 'volume', target: 100_000, startDate: '2026-10-01', endDate: '2026-10-10' };
const bench = { id: 'bench', primary: ['chest' as const], equipment: 'barbell' as const };
const pushup = { id: 'pushup', primary: ['chest' as const], equipment: 'body only' as const };

describe('challenges', () => {
  it('volume = weight × reps inside the window only', () => {
    expect(setContribution(volume, { exerciseId: 'bench', weightKg: 100, reps: 5, date: '2026-10-02' }, bench, 80)).toBe(500);
    expect(setContribution(volume, { exerciseId: 'bench', weightKg: 100, reps: 5, date: '2026-10-11' }, bench, 80)).toBe(0);
  });

  it('bodyweight sets count only when enabled', () => {
    const set = { exerciseId: 'pushup', weightKg: 0, reps: 20, date: '2026-10-02' };
    expect(setContribution(volume, set, pushup, 80)).toBe(0);
    expect(setContribution({ ...volume, countBodyweight: true }, set, pushup, 80)).toBe(1600);
  });

  it('filters by exercise or muscle', () => {
    const set = { exerciseId: 'bench', weightKg: 100, reps: 1, date: '2026-10-02' };
    expect(setContribution({ ...volume, exerciseIds: ['squat'] }, set, bench, null)).toBe(0);
    expect(setContribution({ ...volume, muscles: ['chest'] }, set, bench, null)).toBe(100);
    expect(setContribution({ ...volume, kind: 'reps' }, set, bench, null)).toBe(1);
  });

  it('pace and projection', () => {
    // 3 days elapsed, 30,000 done → 10k/day; 70k left over 8 days (Oct 3–10).
    const p = progress(volume, { '2026-10-01': 10_000, '2026-10-02': 10_000, '2026-10-03': 10_000 }, '2026-10-03');
    expect(p.total).toBe(30_000);
    expect(p.daysLeft).toBe(8);
    expect(p.requiredPerDay).toBe(8750);
    expect(p.ratePerDay).toBe(10_000);
    expect(p.projectedFinish).toBe('2026-10-10');
  });

  it('no activity → no projection', () => {
    expect(progress(volume, {}, '2026-10-03').projectedFinish).toBeNull();
  });

  it('completed challenge', () => {
    const p = progress(volume, { '2026-10-01': 120_000 }, '2026-10-02');
    expect(p).toMatchObject({ done: true, remaining: 0, pct: 1 });
  });

  it('calorie days', () => {
    const def: ChallengeDef = { kind: 'calories', target: 5, startDate: '2026-10-01', endDate: '2026-10-10', dailyKcal: 2000, kcalMode: 'at_most' };
    expect(calorieDays(def, { '2026-10-01': 1800, '2026-10-02': 2500, '2026-09-30': 1000 })).toEqual({ '2026-10-01': 1 });
  });

  it('streak survives until today ends', () => {
    const days = new Set(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(currentStreak(days, '2026-10-04', '2026-10-01')).toBe(3);
    expect(currentStreak(days, '2026-10-05', '2026-10-01')).toBe(0);
  });
});

describe('debt', () => {
  const pushups = { exerciseId: 'pushup', sets: 4, repMin: 20, repMax: 25, restS: 60 };
  const benchPlan = { exerciseId: 'bench', sets: 3, repMin: 5, repMax: 5, restS: 180, targetWeightKg: 100 };

  it('reps debt for bodyweight, volume debt with a target weight', () => {
    expect(plannedAmount(pushups)).toBe(100);
    expect(missedAmount(pushups, [{ weightKg: 0, reps: 25 }])).toBe(75);
    expect(plannedAmount(benchPlan)).toBe(1500);
    expect(missedAmount(benchPlan, [{ weightKg: 100, reps: 5 }])).toBe(1000);
    expect(missedAmount(pushups, Array(5).fill({ weightKg: 0, reps: 25 }))).toBe(0);
  });

  const upcoming = [
    { date: 'd1', plannedForMuscle: 100 },
    { date: 'd2', plannedForMuscle: 0 },
    { date: 'd3', plannedForMuscle: 200 },
  ];

  it('default cap is 25% of the day, skipping days without the muscle', () => {
    expect(scheduleRepayment(100, upcoming)).toEqual({
      allocations: [{ date: 'd1', amount: 25 }, { date: 'd3', amount: 50 }],
      unscheduled: 25,
    });
  });

  it('absolute cap override applies to every day', () => {
    expect(scheduleRepayment(100, upcoming, 40).allocations.map((a) => a.amount)).toEqual([40, 40, 20]);
  });

  it('no cap puts it all on the first day', () => {
    expect(scheduleRepayment(100, upcoming, null)).toEqual({ allocations: [{ date: 'd1', amount: 100 }], unscheduled: 0 });
  });

  it('repayment with a substitute is scaled and clamps at owed', () => {
    expect(repaidBy(20, 1.25)).toBe(25);
    expect(applyRepayment(100, 90, 25)).toEqual({ repaid: 100, cleared: true });
    expect(applyRepayment(100, 0, 25)).toEqual({ repaid: 25, cleared: false });
  });
});
