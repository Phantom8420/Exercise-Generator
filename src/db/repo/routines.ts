import type { Exercise, Goal, Intensity, PlannedDay, PlannedExercise, Split } from '../../domain/types';
import type { Db } from '../db';
import { exercisesById } from './exercises';

export interface Routine {
  id: number;
  name: string;
  split: Split;
  goal: Goal;
  isGenerated: boolean;
  isActive: boolean;
  generatorInputs: unknown;
  explanation: unknown;
}

export interface RoutineExercise extends PlannedExercise {
  id: number;
  position: number;
  exercise: Exercise;
}

export interface RoutineDay {
  id: number;
  weekday: number;
  label: string;
  intensity: Intensity;
  minutes: number;
  exercises: RoutineExercise[];
}

interface RoutineRow {
  id: number; name: string; split: Split; goal: Goal; is_generated: number; is_active: number;
  generator_inputs: string | null; explanation: string | null;
}
const toRoutine = (r: RoutineRow): Routine => ({
  id: r.id, name: r.name, split: r.split, goal: r.goal, isGenerated: !!r.is_generated, isActive: !!r.is_active,
  generatorInputs: r.generator_inputs ? JSON.parse(r.generator_inputs) : null,
  explanation: r.explanation ? JSON.parse(r.explanation) : null,
});

export async function listRoutines(db: Db): Promise<(Routine & { dayCount: number })[]> {
  const rows = await db.all<RoutineRow & { day_count: number }>(
    'SELECT r.*, (SELECT COUNT(*) FROM routine_day d WHERE d.routine_id = r.id) day_count FROM routine r ORDER BY r.is_active DESC, r.id DESC',
  );
  return rows.map((r) => ({ ...toRoutine(r), dayCount: r.day_count }));
}

export async function getRoutine(db: Db, id: number): Promise<{ routine: Routine; days: RoutineDay[] } | null> {
  const r = await db.get<RoutineRow>('SELECT * FROM routine WHERE id = ?', [id]);
  if (!r) return null;
  return { routine: toRoutine(r), days: await daysFor(db, id) };
}

async function daysFor(db: Db, routineId: number, weekday?: number): Promise<RoutineDay[]> {
  const days = await db.all<{ id: number; weekday: number; label: string; intensity: Intensity; session_minutes: number }>(
    `SELECT * FROM routine_day WHERE routine_id = ? ${weekday != null ? 'AND weekday = ?' : ''} ORDER BY weekday`,
    weekday != null ? [routineId, weekday] : [routineId],
  );
  if (!days.length) return [];
  const exRows = await db.all<{
    id: number; routine_day_id: number; exercise_id: string; position: number; sets: number; rep_min: number;
    rep_max: number; rest_s: number; target_weight_kg: number | null;
  }>(`SELECT * FROM routine_exercise WHERE routine_day_id IN (${days.map(() => '?').join(',')}) ORDER BY position, id`, days.map((d) => d.id));
  const byId = await exercisesById(db, exRows.map((e) => e.exercise_id));
  return days.map((d) => ({
    id: d.id,
    weekday: d.weekday,
    label: d.label,
    intensity: d.intensity,
    minutes: d.session_minutes,
    exercises: exRows
      .filter((e) => e.routine_day_id === d.id && byId.has(e.exercise_id))
      .map((e) => ({
        id: e.id, position: e.position, exerciseId: e.exercise_id, exercise: byId.get(e.exercise_id)!, sets: e.sets,
        repMin: e.rep_min, repMax: e.rep_max, restS: e.rest_s, targetWeightKg: e.target_weight_kg,
      })),
  }));
}

export async function activeRoutine(db: Db): Promise<Routine | null> {
  const r = await db.get<RoutineRow>('SELECT * FROM routine WHERE is_active = 1 LIMIT 1');
  return r ? toRoutine(r) : null;
}

export async function activeDayFor(db: Db, weekday: number): Promise<RoutineDay | null> {
  const r = await activeRoutine(db);
  if (!r) return null;
  return (await daysFor(db, r.id, weekday))[0] ?? null;
}

export async function activeWeek(db: Db): Promise<RoutineDay[]> {
  const r = await activeRoutine(db);
  return r ? daysFor(db, r.id) : [];
}

export async function getRoutineDay(db: Db, dayId: number): Promise<RoutineDay | null> {
  const d = await db.get<{ routine_id: number; weekday: number }>('SELECT routine_id, weekday FROM routine_day WHERE id = ?', [dayId]);
  return d ? (await daysFor(db, d.routine_id, d.weekday))[0] ?? null : null;
}

export async function createRoutine(db: Db, name: string, split: Split, goal: Goal): Promise<number> {
  const hasActive = await db.get<{ id: number }>('SELECT id FROM routine WHERE is_active = 1');
  return (await db.run('INSERT INTO routine (name, split, goal, is_active) VALUES (?, ?, ?, ?)', [name, split, goal, hasActive ? 0 : 1])).lastInsertRowId;
}

export async function saveGeneratedRoutine(
  db: Db,
  name: string,
  split: Split,
  goal: Goal,
  days: PlannedDay[],
  inputs: unknown,
  explanation: unknown = null,
): Promise<number> {
  return db.tx(async () => {
    const id = (
      await db.run('INSERT INTO routine (name, split, goal, is_generated, generator_inputs, explanation) VALUES (?, ?, ?, 1, ?, ?)', [
        name, split, goal, JSON.stringify(inputs), explanation ? JSON.stringify(explanation) : null,
      ])
    ).lastInsertRowId;
    await writeDays(db, id, days);
    await db.run('UPDATE routine SET is_active = (id = ?)', [id]);
    return id;
  });
}

async function writeDays(db: Db, routineId: number, days: PlannedDay[]) {
  for (const d of days) {
    const dayId = (
      await db.run('INSERT INTO routine_day (routine_id, weekday, label, intensity, session_minutes) VALUES (?, ?, ?, ?, ?)', [
        routineId, d.weekday, d.label, d.intensity, d.minutes,
      ])
    ).lastInsertRowId;
    let pos = 0;
    for (const e of d.exercises) {
      await db.run(
        'INSERT INTO routine_exercise (routine_day_id, exercise_id, position, sets, rep_min, rep_max, rest_s, target_weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [dayId, e.exerciseId, pos++, e.sets, e.repMin, e.repMax, e.restS, e.targetWeightKg ?? null],
      );
    }
  }
}

/** Replaces a routine's days with a regenerated set, keeping the routine row. */
export async function replaceDays(db: Db, routineId: number, days: PlannedDay[], inputs: unknown): Promise<void> {
  await db.tx(async () => {
    await db.run('DELETE FROM routine_day WHERE routine_id = ?', [routineId]);
    await writeDays(db, routineId, days);
    await db.run('UPDATE routine SET generator_inputs = ? WHERE id = ?', [JSON.stringify(inputs), routineId]);
  });
}

export async function renameRoutine(db: Db, id: number, name: string): Promise<void> {
  await db.run('UPDATE routine SET name = ? WHERE id = ?', [name, id]);
}
export async function setActiveRoutine(db: Db, id: number): Promise<void> {
  await db.run('UPDATE routine SET is_active = (id = ?)', [id]);
}
export async function deleteRoutine(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM routine WHERE id = ?', [id]);
}

export async function upsertDay(db: Db, routineId: number, weekday: number, patch: { label?: string; intensity?: Intensity; minutes?: number }): Promise<number> {
  const existing = await db.get<{ id: number }>('SELECT id FROM routine_day WHERE routine_id = ? AND weekday = ?', [routineId, weekday]);
  if (!existing) {
    return (
      await db.run('INSERT INTO routine_day (routine_id, weekday, label, intensity, session_minutes) VALUES (?, ?, ?, ?, ?)', [
        routineId, weekday, patch.label ?? 'Training', patch.intensity ?? 'moderate', patch.minutes ?? 60,
      ])
    ).lastInsertRowId;
  }
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (patch.label != null) { sets.push('label = ?'); params.push(patch.label); }
  if (patch.intensity != null) { sets.push('intensity = ?'); params.push(patch.intensity); }
  if (patch.minutes != null) { sets.push('session_minutes = ?'); params.push(patch.minutes); }
  if (sets.length) await db.run(`UPDATE routine_day SET ${sets.join(', ')} WHERE id = ?`, [...params, existing.id]);
  return existing.id;
}

export async function deleteDay(db: Db, dayId: number): Promise<void> {
  await db.run('DELETE FROM routine_day WHERE id = ?', [dayId]);
}

export async function addRoutineExercise(db: Db, dayId: number, e: PlannedExercise): Promise<number> {
  const pos = await db.get<{ p: number | null }>('SELECT MAX(position) p FROM routine_exercise WHERE routine_day_id = ?', [dayId]);
  return (
    await db.run(
      'INSERT INTO routine_exercise (routine_day_id, exercise_id, position, sets, rep_min, rep_max, rest_s, target_weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [dayId, e.exerciseId, (pos?.p ?? -1) + 1, e.sets, e.repMin, e.repMax, e.restS, e.targetWeightKg ?? null],
    )
  ).lastInsertRowId;
}

export async function updateRoutineExercise(db: Db, id: number, e: Partial<PlannedExercise>): Promise<void> {
  const map: Record<string, string> = { exerciseId: 'exercise_id', sets: 'sets', repMin: 'rep_min', repMax: 'rep_max', restS: 'rest_s', targetWeightKg: 'target_weight_kg' };
  const keys = Object.keys(e).filter((k) => k in map) as (keyof PlannedExercise)[];
  if (!keys.length) return;
  await db.run(`UPDATE routine_exercise SET ${keys.map((k) => `${map[k]} = ?`).join(', ')} WHERE id = ?`, [
    ...keys.map((k) => (e[k] ?? null) as string | number | null),
    id,
  ]);
}

export async function removeRoutineExercise(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM routine_exercise WHERE id = ?', [id]);
}

/** Swaps position with the neighbour in the given direction. */
export async function moveRoutineExercise(db: Db, id: number, dir: -1 | 1): Promise<void> {
  const cur = await db.get<{ routine_day_id: number; position: number }>('SELECT routine_day_id, position FROM routine_exercise WHERE id = ?', [id]);
  if (!cur) return;
  const other = await db.get<{ id: number; position: number }>(
    `SELECT id, position FROM routine_exercise WHERE routine_day_id = ? AND position ${dir < 0 ? '<' : '>'} ? ORDER BY position ${dir < 0 ? 'DESC' : 'ASC'} LIMIT 1`,
    [cur.routine_day_id, cur.position],
  );
  if (!other) return;
  await db.tx(async () => {
    await db.run('UPDATE routine_exercise SET position = ? WHERE id = ?', [other.position, id]);
    await db.run('UPDATE routine_exercise SET position = ? WHERE id = ?', [cur.position, other.id]);
  });
}
