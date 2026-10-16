import exercises from '../../data/exercises.json';
import foods from '../../data/foods.json';
import { addDays, today, weekdayOf } from '../../domain/dates';
import { generateRoutine } from '../../domain/generator';
import { parseMenu } from '../../domain/menu';
import { exportData } from '../exportData';
import { migrate, MIGRATIONS } from '../migrations';
import { createChallenge, getChallenge } from '../repo/challenges';
import { getSetting, setSetting } from '../repo/core';
import { deleteSet, listDebts, logSet, setDebtCap, settleDebts } from '../repo/debts';
import { allExercises, listExercises } from '../repo/exercises';
import { activePlan, importMenu, totals } from '../repo/nutrition';
import { activeWeek, saveGeneratedRoutine } from '../repo/routines';
import { startSession } from '../repo/workouts';
import { seedExercises, seedFoods } from '../seed';
import type { Db } from '../db';
import { freshDb } from './nodeDb';

let db: Db;
beforeAll(async () => {
  db = await freshDb();
  await seedExercises(db, exercises);
  await seedFoods(db, foods);
});

it('migrates to the latest version and is idempotent', async () => {
  expect((await db.get<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(MIGRATIONS.length);
  await migrate(db);
  expect((await db.get<{ n: number }>('SELECT COUNT(*) n FROM user'))?.n).toBe(1);
});

it('seeds the bundled datasets once', async () => {
  expect(await seedExercises(db, exercises)).toBe(0);
  expect((await db.get<{ n: number }>('SELECT COUNT(*) n FROM exercise'))?.n).toBe(exercises.length);
  expect((await db.get<{ n: number }>('SELECT COUNT(*) n FROM food'))?.n).toBe(foods.length);
  expect((await listExercises(db, { q: 'bench press', limit: 5 })).length).toBeGreaterThan(0);
});

it('rejects a malformed dataset', async () => {
  const other = await freshDb();
  await expect(seedExercises(other, [{ id: 'x' }])).rejects.toThrow();
});

it('a failing transaction rolls back', async () => {
  await expect(db.tx(async () => { await setSetting(db, 'probe', '1'); throw new Error('boom'); })).rejects.toThrow('boom');
  expect(await getSetting(db, 'probe')).toBeNull();
});

describe('debt, challenges and nutrition end to end', () => {
  const now = today();
  const yesterday = addDays(now, -1);

  beforeAll(async () => {
    const days = generateRoutine(
      {
        split: 'full_body', goal: 'gain_muscle', experience: 'intermediate', equipment: ['barbell', 'dumbbell', 'body only'], seed: 3,
        days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, intensity: 'moderate' as const, minutes: 45 })),
      },
      await allExercises(db),
    );
    await saveGeneratedRoutine(db, 'Test', 'full_body', 'gain_muscle', days, {});
  });

  it('saves and reads the active week', async () => {
    const week = await activeWeek(db);
    expect(week).toHaveLength(7);
    expect(week[0].exercises.length).toBeGreaterThan(0);
  });

  it('first settle only records a start point', async () => {
    await settleDebts(db, now);
    expect(await getSetting(db, 'debt_checked_through')).toBe(yesterday);
    expect(await listDebts(db)).toHaveLength(0);
  });

  it('turns a skipped day into scheduled debt, and repayment clears it', async () => {
    await setSetting(db, 'debt_checked_through', addDays(now, -2));
    await settleDebts(db, now);
    const skipped = (await activeWeek(db)).find((d) => d.weekday === weekdayOf(yesterday))!;
    const debts = await listDebts(db);
    expect(debts).toHaveLength(skipped.exercises.length);
    expect(debts.every((d) => d.createdFor === yesterday && d.owed > 0)).toBe(true);

    // settling again doesn't duplicate
    await setSetting(db, 'debt_checked_through', addDays(now, -2));
    await settleDebts(db, now);
    expect(await listDebts(db)).toHaveLength(debts.length);

    const d = debts.find((x) => x.metric === 'reps') ?? debts[0];
    await setDebtCap(db, d.id, 'none');
    const uncapped = (await listDebts(db)).find((x) => x.id === d.id)!;
    expect(uncapped.allocations.reduce((s, a) => s + a.amount, 0)).toBeCloseTo(d.owed, 0);

    const session = await startSession(db, null, now);
    const reps = Math.ceil(d.owed);
    const set = await logSet(db, session, d.exercise.id, d.metric === 'volume' ? 1 : 0, reps, d.id);
    if (d.metric === 'reps') {
      const after = (await listDebts(db, true)).find((x) => x.id === d.id)!;
      expect(after.status).toBe('cleared');
      expect(after.allocations).toHaveLength(0);
    }
    await deleteSet(db, set.id);
    const reverted = (await listDebts(db, true)).find((x) => x.id === d.id)!;
    expect(reverted.repaid).toBe(0);
    expect(reverted.status).toBe('open');
  });

  it('challenge progress is counted from logged sets', async () => {
    const id = await createChallenge(db, { name: 'Reps', kind: 'reps', target: 100, startDate: now, endDate: addDays(now, 9) });
    const session = await startSession(db, null, now);
    const exId = (await allExercises(db))[0].id;
    await logSet(db, session, exId, 20, 10);
    await logSet(db, session, exId, 20, 15);
    const s = (await getChallenge(db, id))!;
    expect(s.progress.total).toBe(25);
    expect(s.progress.remaining).toBe(75);
  });

  it('imports a menu and matches foods', async () => {
    await importMenu(db, 'Week', parseMenu('Breakfast: 3 eggs, 200g oatmeal\nDinner: 250g chicken breast, 200g rice'));
    const plan = (await activePlan(db))!;
    const items = plan.meals.flatMap((m) => m.items);
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.food)).toBe(true);
    const t = totals(items);
    expect(t.protein).toBeGreaterThan(60);
    expect(t.kcal).toBeGreaterThan(600);
  });
});

it('export skips bundled datasets and is valid JSON', async () => {
  const out = await exportData(db);
  expect(out.tables.exercise).toBeUndefined();
  expect(out.tables.food).toEqual([]);
  expect(out.tables.user).toHaveLength(1);
  expect(JSON.parse(JSON.stringify(out)).app).toBe('plasma');
});
