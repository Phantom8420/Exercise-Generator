import { z } from 'zod';
import { EQUIPMENT, MUSCLES } from '../domain/types';
import type { Db, SqlValue } from './db';

const ExerciseRow = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  force: z.enum(['push', 'pull', 'static']).nullable(),
  level: z.enum(['beginner', 'intermediate', 'expert']),
  mechanic: z.enum(['compound', 'isolation']).nullable(),
  equipment: z.enum(EQUIPMENT),
  primary: z.array(z.enum(MUSCLES)).min(1),
  secondary: z.array(z.enum(MUSCLES)),
  instructions: z.array(z.string()),
  category: z.string(),
  images: z.array(z.string()),
});
export const ExerciseDataset = z.array(ExerciseRow);

// [fdcId, name, category, kcal, protein, carbs, fat, portionG, portionLabel]
export const FoodDataset = z.array(
  z.tuple([z.number(), z.string(), z.string(), z.number(), z.number(), z.number(), z.number(), z.number(), z.string()]),
);

async function insertChunked(db: Db, head: string, cols: number, rows: SqlValue[][], chunk = 80) {
  const ph = `(${Array(cols).fill('?').join(',')})`;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    await db.run(`${head} VALUES ${part.map(() => ph).join(',')}`, part.flat());
  }
}

export async function seedExercises(db: Db, raw: unknown): Promise<number> {
  const have = await db.get<{ n: number }>('SELECT COUNT(*) n FROM exercise WHERE is_custom = 0');
  if (have && have.n > 0) return 0;
  const data = ExerciseDataset.parse(raw);
  const rows = data.map((e) => [
    e.id, e.name, JSON.stringify(e.primary), JSON.stringify(e.secondary), e.primary[0], e.equipment, e.mechanic, e.force,
    e.level, e.category, JSON.stringify(e.instructions), JSON.stringify(e.images), 'free-exercise-db', e.id,
  ]);
  await db.tx(() =>
    insertChunked(
      db,
      'INSERT INTO exercise (id, name, primary_muscles, secondary_muscles, primary_muscle, equipment, mechanic, force, level, category, instructions, images, source, source_ref)',
      14,
      rows,
    ),
  );
  return rows.length;
}

export async function seedFoods(db: Db, raw: unknown): Promise<number> {
  const have = await db.get<{ n: number }>("SELECT COUNT(*) n FROM food WHERE source = 'usda'");
  if (have && have.n > 0) return 0;
  const data = FoodDataset.parse(raw);
  const rows = data.map(([id, name, cat, kcal, p, c, f, g, label]) => [name, 'usda', String(id), cat, kcal, p, c, f, g, label]);
  await db.tx(() =>
    insertChunked(db, 'INSERT INTO food (name, source, source_ref, category, kcal, protein, carbs, fat, portion_g, portion_label)', 10, rows),
  );
  return rows.length;
}
