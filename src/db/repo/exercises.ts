import type { Equipment, Exercise, Muscle } from '../../domain/types';
import type { Db } from '../db';

interface Row {
  id: string; name: string; primary_muscles: string; secondary_muscles: string; equipment: Equipment;
  mechanic: Exercise['mechanic']; force: Exercise['force']; level: Exercise['level']; category: string;
  instructions: string; mistakes: string; images: string;
}

export function toExercise(r: Row): Exercise {
  return {
    id: r.id, name: r.name, primary: JSON.parse(r.primary_muscles), secondary: JSON.parse(r.secondary_muscles),
    equipment: r.equipment, mechanic: r.mechanic, force: r.force, level: r.level, category: r.category,
    instructions: JSON.parse(r.instructions), mistakes: JSON.parse(r.mistakes), images: JSON.parse(r.images),
  };
}

export interface ExerciseFilter {
  q?: string;
  muscle?: Muscle | null;
  equipment?: Equipment[] | null;
  limit?: number;
}

export async function listExercises(db: Db, f: ExerciseFilter = {}): Promise<Exercise[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.q?.trim()) {
    for (const word of f.q.trim().split(/\s+/)) {
      where.push('name LIKE ?');
      params.push(`%${word}%`);
    }
  }
  if (f.muscle) {
    where.push('primary_muscle = ?');
    params.push(f.muscle);
  }
  if (f.equipment) {
    where.push(`equipment IN (${['body only', ...f.equipment].map(() => '?').join(',')})`);
    params.push('body only', ...f.equipment);
  }
  const sql = `SELECT * FROM exercise ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name LIMIT ?`;
  return (await db.all<Row>(sql, [...params, f.limit ?? 1000])).map(toExercise);
}

export async function getExercise(db: Db, id: string): Promise<Exercise | null> {
  const r = await db.get<Row>('SELECT * FROM exercise WHERE id = ?', [id]);
  return r ? toExercise(r) : null;
}

export async function allExercises(db: Db): Promise<Exercise[]> {
  return (await db.all<Row>('SELECT * FROM exercise')).map(toExercise);
}

export async function exercisesById(db: Db, ids: string[]): Promise<Map<string, Exercise>> {
  if (!ids.length) return new Map();
  const uniq = [...new Set(ids)];
  const rows = await db.all<Row>(`SELECT * FROM exercise WHERE id IN (${uniq.map(() => '?').join(',')})`, uniq);
  return new Map(rows.map((r) => [r.id, toExercise(r)]));
}

export async function updateMistakes(db: Db, id: string, mistakes: string[]): Promise<void> {
  await db.run('UPDATE exercise SET mistakes = ? WHERE id = ?', [JSON.stringify(mistakes), id]);
}
