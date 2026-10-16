import { today } from '../../domain/dates';
import type { Exercise } from '../../domain/types';
import type { Db } from '../db';
import { exercisesById } from './exercises';

export interface LoggedSet {
  id: number;
  sessionId: number;
  exerciseId: string;
  day: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  debtId: number | null;
}

interface SetRow {
  id: number; session_id: number; exercise_id: string; day: string; set_index: number; weight_kg: number; reps: number; debt_id: number | null;
}
const toSet = (r: SetRow): LoggedSet => ({
  id: r.id, sessionId: r.session_id, exerciseId: r.exercise_id, day: r.day, setIndex: r.set_index, weightKg: r.weight_kg, reps: r.reps, debtId: r.debt_id,
});

export interface Session {
  id: number;
  routineDayId: number | null;
  day: string;
  startedAt: string;
  endedAt: string | null;
}
interface SessionRow { id: number; routine_day_id: number | null; day: string; started_at: string; ended_at: string | null }
const toSession = (r: SessionRow): Session => ({ id: r.id, routineDayId: r.routine_day_id, day: r.day, startedAt: r.started_at, endedAt: r.ended_at });

export async function activeSession(db: Db): Promise<Session | null> {
  const r = await db.get<SessionRow>('SELECT * FROM workout_session WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1');
  return r ? toSession(r) : null;
}

export async function startSession(db: Db, routineDayId: number | null, day = today()): Promise<number> {
  const open = await activeSession(db);
  if (open) return open.id;
  return (await db.run('INSERT INTO workout_session (routine_day_id, day, started_at) VALUES (?, ?, ?)', [routineDayId, day, new Date().toISOString()])).lastInsertRowId;
}

export async function endSession(db: Db, id: number): Promise<void> {
  await db.run('UPDATE workout_session SET ended_at = ? WHERE id = ?', [new Date().toISOString(), id]);
}

export async function deleteSession(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM workout_session WHERE id = ?', [id]);
}

/** Logs one set; debt repayment (if any) is applied by the debt module in the same transaction. */
export async function insertSet(db: Db, sessionId: number, exerciseId: string, weightKg: number, reps: number, debtId: number | null = null): Promise<LoggedSet> {
  const s = await db.get<{ day: string }>('SELECT day FROM workout_session WHERE id = ?', [sessionId]);
  if (!s) throw new Error(`session ${sessionId} not found`);
  const idx = await db.get<{ n: number }>('SELECT COUNT(*) n FROM logged_set WHERE session_id = ? AND exercise_id = ?', [sessionId, exerciseId]);
  const { lastInsertRowId } = await db.run(
    'INSERT INTO logged_set (session_id, exercise_id, day, set_index, weight_kg, reps, debt_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [sessionId, exerciseId, s.day, idx?.n ?? 0, weightKg, reps, debtId],
  );
  return { id: lastInsertRowId, sessionId, exerciseId, day: s.day, setIndex: idx?.n ?? 0, weightKg, reps, debtId };
}

export async function getSet(db: Db, id: number): Promise<LoggedSet | null> {
  const r = await db.get<SetRow>('SELECT * FROM logged_set WHERE id = ?', [id]);
  return r ? toSet(r) : null;
}

export async function deleteSetRow(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM logged_set WHERE id = ?', [id]);
}

export async function setsForSession(db: Db, sessionId: number): Promise<LoggedSet[]> {
  return (await db.all<SetRow>('SELECT * FROM logged_set WHERE session_id = ? ORDER BY id', [sessionId])).map(toSet);
}

export async function setsBetween(db: Db, from: string, to: string): Promise<LoggedSet[]> {
  return (await db.all<SetRow>('SELECT * FROM logged_set WHERE day BETWEEN ? AND ? ORDER BY id', [from, to])).map(toSet);
}

export async function lastSetFor(db: Db, exerciseId: string): Promise<LoggedSet | null> {
  const r = await db.get<SetRow>('SELECT * FROM logged_set WHERE exercise_id = ? ORDER BY id DESC LIMIT 1', [exerciseId]);
  return r ? toSet(r) : null;
}

export async function listSessions(db: Db, limit = 100): Promise<(Session & { sets: number; volume: number; label: string | null })[]> {
  const rows = await db.all<SessionRow & { sets: number; volume: number; label: string | null }>(
    `SELECT s.*, COUNT(l.id) sets, COALESCE(SUM(l.weight_kg * l.reps), 0) volume, d.label
     FROM workout_session s LEFT JOIN logged_set l ON l.session_id = s.id LEFT JOIN routine_day d ON d.id = s.routine_day_id
     GROUP BY s.id ORDER BY s.started_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({ ...toSession(r), sets: r.sets, volume: r.volume, label: r.label }));
}

export async function sessionDetail(db: Db, id: number): Promise<{ session: Session; sets: LoggedSet[]; exercises: Map<string, Exercise> } | null> {
  const r = await db.get<SessionRow>('SELECT * FROM workout_session WHERE id = ?', [id]);
  if (!r) return null;
  const sets = await setsForSession(db, id);
  return { session: toSession(r), sets, exercises: await exercisesById(db, sets.map((s) => s.exerciseId)) };
}

export async function volumeByDay(db: Db, from: string, to: string): Promise<Record<string, { volume: number; sets: number; reps: number }>> {
  const rows = await db.all<{ day: string; volume: number; sets: number; reps: number }>(
    'SELECT day, SUM(weight_kg * reps) volume, COUNT(*) sets, SUM(reps) reps FROM logged_set WHERE day BETWEEN ? AND ? GROUP BY day',
    [from, to],
  );
  return Object.fromEntries(rows.map((r) => [r.day, { volume: r.volume, sets: r.sets, reps: r.reps }]));
}

export async function trainedDays(db: Db, since: string): Promise<Set<string>> {
  const rows = await db.all<{ day: string }>('SELECT DISTINCT day FROM logged_set WHERE day >= ?', [since]);
  return new Set(rows.map((r) => r.day));
}
