import { addDays, today, weekdayOf } from '../../domain/dates';
import { debtMetric, missedAmount, plannedAmount, scheduleRepayment, type DebtMetric } from '../../domain/debt';
import { equivalenceFactor } from '../../domain/substitutes';
import type { Exercise, Muscle } from '../../domain/types';
import type { Db } from '../db';
import { getSetting, setSetting } from './core';
import { exercisesById, getExercise } from './exercises';
import { activeWeek, type RoutineDay } from './routines';
import { deleteSetRow, getSet, insertSet, type LoggedSet } from './workouts';

export type CapMode = 'default' | 'custom' | 'none';

export interface Debt {
  id: number;
  exercise: Exercise;
  muscle: Muscle;
  metric: DebtMetric;
  owed: number;
  repaid: number;
  createdFor: string;
  capMode: CapMode;
  dailyCap: number | null;
  status: 'open' | 'cleared';
  allocations: { day: string; amount: number }[];
}

interface Row {
  id: number; exercise_id: string; muscle: Muscle; metric: DebtMetric; owed: number; repaid: number; created_for: string;
  daily_cap: number | null; cap_mode: CapMode; status: 'open' | 'cleared';
}

const HORIZON_DAYS = 14;
const MAX_BACKFILL_DAYS = 14;

/**
 * Turns unlogged planned work from past days into debt, then reschedules every open debt.
 * The first ever run only records a starting point so installing the app doesn't create debt.
 */
export async function settleDebts(db: Db, now = today()): Promise<void> {
  const yesterday = addDays(now, -1);
  const last = await getSetting(db, 'debt_checked_through');
  if (!last) {
    await setSetting(db, 'debt_checked_through', yesterday);
    return;
  }
  const week = await activeWeek(db);
  let day = last > addDays(now, -MAX_BACKFILL_DAYS - 1) ? addDays(last, 1) : addDays(now, -MAX_BACKFILL_DAYS);
  await db.tx(async () => {
    for (; day <= yesterday; day = addDays(day, 1)) {
      const plan = week.find((d) => d.weekday === weekdayOf(day));
      if (!plan) continue;
      for (const pe of plan.exercises) {
        const logged = await db.all<{ weight_kg: number; reps: number }>(
          'SELECT weight_kg, reps FROM logged_set WHERE day = ? AND exercise_id = ? AND debt_id IS NULL',
          [day, pe.exerciseId],
        );
        const missed = missedAmount(pe, logged.map((l) => ({ weightKg: l.weight_kg, reps: l.reps })));
        if (missed <= 0) continue;
        await db.run('INSERT OR IGNORE INTO debt (exercise_id, muscle, metric, owed, created_for) VALUES (?, ?, ?, ?, ?)', [
          pe.exerciseId, pe.exercise.primary[0], debtMetric(pe), missed, day,
        ]);
      }
    }
    if (yesterday > last) await setSetting(db, 'debt_checked_through', yesterday);
    await rescheduleAll(db, now, week);
  });
}

/** Planned amount for a muscle on each of the next HORIZON_DAYS days, in the debt's metric. */
function upcomingFor(week: RoutineDay[], muscle: Muscle, metric: DebtMetric, from: string) {
  return Array.from({ length: HORIZON_DAYS }, (_, i) => {
    const date = addDays(from, i);
    const day = week.find((d) => d.weekday === weekdayOf(date));
    const plannedForMuscle = (day?.exercises ?? [])
      .filter((e) => e.exercise.primary[0] === muscle && debtMetric(e) === metric)
      .reduce((s, e) => s + plannedAmount(e), 0);
    return { date, plannedForMuscle };
  });
}

async function reschedule(db: Db, r: Row, now: string, week: RoutineDay[]) {
  await db.run('DELETE FROM debt_allocation WHERE debt_id = ? AND day >= ?', [r.id, now]);
  if (r.status !== 'open') return;
  const cap = r.cap_mode === 'none' ? null : r.cap_mode === 'custom' ? r.daily_cap ?? undefined : undefined;
  const { allocations } = scheduleRepayment(r.owed - r.repaid, upcomingFor(week, r.muscle, r.metric, now), cap);
  for (const a of allocations) {
    await db.run('INSERT INTO debt_allocation (debt_id, day, amount) VALUES (?, ?, ?)', [r.id, a.date, Math.round(a.amount * 10) / 10]);
  }
}

export async function rescheduleAll(db: Db, now = today(), week?: RoutineDay[]): Promise<void> {
  const w = week ?? (await activeWeek(db));
  for (const r of await db.all<Row>("SELECT * FROM debt WHERE status = 'open'")) await reschedule(db, r, now, w);
}

export async function listDebts(db: Db, includeCleared = false, now = today()): Promise<Debt[]> {
  const rows = await db.all<Row>(`SELECT * FROM debt ${includeCleared ? '' : "WHERE status = 'open'"} ORDER BY created_for, id`);
  const exs = await exercisesById(db, rows.map((r) => r.exercise_id));
  const allocs = await db.all<{ debt_id: number; day: string; amount: number }>('SELECT * FROM debt_allocation WHERE day >= ? ORDER BY day', [now]);
  return rows
    .filter((r) => exs.has(r.exercise_id))
    .map((r) => ({
      id: r.id, exercise: exs.get(r.exercise_id)!, muscle: r.muscle, metric: r.metric, owed: r.owed, repaid: r.repaid,
      createdFor: r.created_for, capMode: r.cap_mode, dailyCap: r.daily_cap, status: r.status,
      allocations: allocs.filter((a) => a.debt_id === r.id).map((a) => ({ day: a.day, amount: a.amount })),
    }));
}

export async function setDebtCap(db: Db, id: number, mode: CapMode, cap: number | null = null): Promise<void> {
  await db.run('UPDATE debt SET cap_mode = ?, daily_cap = ? WHERE id = ?', [mode, cap, id]);
  const r = await db.get<Row>('SELECT * FROM debt WHERE id = ?', [id]);
  if (r) await reschedule(db, r, today(), await activeWeek(db));
}

export async function forgiveDebt(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM debt WHERE id = ?', [id]);
}

/** Repaid = Σ over sets tagged with this debt of amount × equivalence factor (substitutes scale). */
async function recomputeRepaid(db: Db, debtId: number) {
  const r = await db.get<Row>('SELECT * FROM debt WHERE id = ?', [debtId]);
  if (!r) return;
  const sets = await db.all<{ exercise_id: string; weight_kg: number; reps: number }>('SELECT exercise_id, weight_kg, reps FROM logged_set WHERE debt_id = ?', [debtId]);
  const exs = await exercisesById(db, [r.exercise_id, ...sets.map((s) => s.exercise_id)]);
  const from = exs.get(r.exercise_id)!;
  let repaid = 0;
  for (const s of sets) {
    const to = exs.get(s.exercise_id) ?? from;
    repaid += (r.metric === 'volume' ? s.weight_kg * s.reps : s.reps) * equivalenceFactor(from, to);
  }
  repaid = Math.min(r.owed, repaid);
  const status = repaid >= r.owed ? 'cleared' : 'open';
  await db.run('UPDATE debt SET repaid = ?, status = ? WHERE id = ?', [repaid, status, debtId]);
  await reschedule(db, { ...r, repaid, status }, today(), await activeWeek(db));
}

/** Logs a set and, when it's a repayment, updates the debt in the same transaction. */
export async function logSet(db: Db, sessionId: number, exerciseId: string, weightKg: number, reps: number, debtId: number | null = null): Promise<LoggedSet> {
  return db.tx(async () => {
    const set = await insertSet(db, sessionId, exerciseId, weightKg, reps, debtId);
    if (debtId != null) await recomputeRepaid(db, debtId);
    return set;
  });
}

export async function deleteSet(db: Db, id: number): Promise<void> {
  await db.tx(async () => {
    const s = await getSet(db, id);
    await deleteSetRow(db, id);
    if (s?.debtId != null) await recomputeRepaid(db, s.debtId);
  });
}

export async function equivalenceFor(db: Db, debtExerciseId: string, doneExerciseId: string): Promise<number> {
  const [a, b] = await Promise.all([getExercise(db, debtExerciseId), getExercise(db, doneExerciseId)]);
  return a && b ? equivalenceFactor(a, b) : 1;
}
