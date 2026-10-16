import { calorieDays, currentStreak, progress, setContribution, type ChallengeDef, type ChallengeKind, type Progress } from '../../domain/challenges';
import { today } from '../../domain/dates';
import type { Muscle } from '../../domain/types';
import type { Db } from '../db';
import { latestWeightKg } from './core';
import { exercisesById } from './exercises';
import { kcalByDay } from './nutrition';
import { setsBetween, trainedDays } from './workouts';

export interface Challenge extends ChallengeDef {
  id: number;
  name: string;
}

interface Row {
  id: number; name: string; kind: ChallengeKind; target: number; start_date: string; end_date: string;
  exercise_ids: string | null; muscles: string | null; count_bodyweight: number; daily_kcal: number | null; kcal_mode: 'at_least' | 'at_most' | null;
}
const toChallenge = (r: Row): Challenge => ({
  id: r.id, name: r.name, kind: r.kind, target: r.target, startDate: r.start_date, endDate: r.end_date,
  exerciseIds: r.exercise_ids ? JSON.parse(r.exercise_ids) : null,
  muscles: r.muscles ? (JSON.parse(r.muscles) as Muscle[]) : null,
  countBodyweight: !!r.count_bodyweight, dailyKcal: r.daily_kcal, kcalMode: r.kcal_mode,
});

export async function createChallenge(db: Db, c: Omit<Challenge, 'id'>): Promise<number> {
  return (
    await db.run(
      'INSERT INTO challenge (name, kind, target, start_date, end_date, exercise_ids, muscles, count_bodyweight, daily_kcal, kcal_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        c.name, c.kind, c.target, c.startDate, c.endDate,
        c.exerciseIds?.length ? JSON.stringify(c.exerciseIds) : null,
        c.muscles?.length ? JSON.stringify(c.muscles) : null,
        c.countBodyweight ? 1 : 0, c.dailyKcal ?? null, c.kcalMode ?? null,
      ],
    )
  ).lastInsertRowId;
}

export async function deleteChallenge(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM challenge WHERE id = ?', [id]);
}

export interface ChallengeStatus {
  challenge: Challenge;
  progress: Progress;
  byDay: Record<string, number>;
}

/** Progress is derived from logged sets / food log on every read, so it can't drift from the source data. */
export async function challengeStatus(db: Db, c: Challenge, now = today()): Promise<ChallengeStatus> {
  const byDay: Record<string, number> = {};
  if (c.kind === 'volume' || c.kind === 'reps') {
    const sets = await setsBetween(db, c.startDate, c.endDate);
    const exs = await exercisesById(db, sets.map((s) => s.exerciseId));
    const bw = c.countBodyweight ? await latestWeightKg(db) : null;
    for (const s of sets) {
      const v = setContribution(c, { exerciseId: s.exerciseId, weightKg: s.weightKg, reps: s.reps, date: s.day }, exs.get(s.exerciseId), bw);
      if (v) byDay[s.day] = (byDay[s.day] ?? 0) + v;
    }
    return { challenge: c, byDay, progress: progress(c, byDay, now) };
  }
  if (c.kind === 'calories') {
    Object.assign(byDay, calorieDays(c, await kcalByDay(db, c.startDate, c.endDate)));
    return { challenge: c, byDay, progress: progress(c, byDay, now) };
  }
  const days = await trainedDays(db, c.startDate);
  for (const d of days) if (d <= c.endDate) byDay[d] = 1;
  const streak = currentStreak(days, now < c.endDate ? now : c.endDate, c.startDate);
  return { challenge: c, byDay, progress: progress(c, byDay, now, streak) };
}

export async function listChallenges(db: Db): Promise<ChallengeStatus[]> {
  const rows = await db.all<Row>('SELECT * FROM challenge ORDER BY end_date DESC, id DESC');
  return Promise.all(rows.map((r) => challengeStatus(db, toChallenge(r))));
}

export async function getChallenge(db: Db, id: number): Promise<ChallengeStatus | null> {
  const r = await db.get<Row>('SELECT * FROM challenge WHERE id = ?', [id]);
  return r ? challengeStatus(db, toChallenge(r)) : null;
}
