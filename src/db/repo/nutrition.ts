import { confidence, matchFoods } from '../../domain/matcher';
import type { ParsedMeal } from '../../domain/menu';
import type { Db } from '../db';

export interface Food {
  id: number;
  name: string;
  source: 'usda' | 'off' | 'custom';
  category: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portionG: number;
  portionLabel: string;
}
interface FoodRow {
  id: number; name: string; source: Food['source']; category: string; kcal: number; protein: number; carbs: number; fat: number; portion_g: number; portion_label: string;
}
const toFood = (r: FoodRow): Food => ({
  id: r.id, name: r.name, source: r.source, category: r.category, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, portionG: r.portion_g, portionLabel: r.portion_label,
});

// 7.8k names is small; one in-memory copy makes fuzzy search instant. Invalidated on custom food insert.
let nameCache: { id: number; name: string }[] | null = null;
async function names(db: Db) {
  nameCache ??= await db.all<{ id: number; name: string }>('SELECT id, name FROM food');
  return nameCache;
}

export async function searchFoods(db: Db, q: string, limit = 20): Promise<Food[]> {
  if (!q.trim()) return [];
  const hits = matchFoods(q, await names(db), limit);
  const byId = await foodsById(db, hits.map((h) => h.food.id));
  return hits.map((h) => byId.get(h.food.id)!).filter(Boolean);
}

export async function foodsById(db: Db, ids: number[]): Promise<Map<number, Food>> {
  if (!ids.length) return new Map();
  const uniq = [...new Set(ids)];
  const rows = await db.all<FoodRow>(`SELECT * FROM food WHERE id IN (${uniq.map(() => '?').join(',')})`, uniq);
  return new Map(rows.map((r) => [r.id, toFood(r)]));
}

export async function foodsInCategory(db: Db, category: string): Promise<Food[]> {
  return (await db.all<FoodRow>('SELECT * FROM food WHERE category = ?', [category])).map(toFood);
}

export async function addFood(db: Db, f: Omit<Food, 'id'> & { sourceRef?: string | null }): Promise<number> {
  const id = (
    await db.run('INSERT INTO food (name, source, source_ref, category, kcal, protein, carbs, fat, portion_g, portion_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      f.name, f.source, f.sourceRef ?? null, f.category, f.kcal, f.protein, f.carbs, f.fat, f.portionG, f.portionLabel,
    ])
  ).lastInsertRowId;
  nameCache = null;
  return id;
}

// ---------- meal plans ----------
export interface MealItem {
  id: number;
  mealId: number;
  rawText: string;
  grams: number;
  confidence: number;
  food: Food | null;
}
export interface Meal {
  id: number;
  weekday: number | null;
  label: string;
  items: MealItem[];
}
export interface MealPlan {
  id: number;
  name: string;
  meals: Meal[];
}

/** Matches each parsed item to the best food and stores the plan; low-confidence matches are fixable in the UI. */
export async function importMenu(db: Db, name: string, meals: ParsedMeal[]): Promise<number> {
  const all = await names(db);
  const matches = meals.flatMap((m) => m.items.map((i) => matchFoods(i.name, all, 1)[0]?.food.id ?? null));
  const foods = await foodsById(db, matches.filter((x): x is number => x != null));
  return db.tx(async () => {
    await db.run('UPDATE meal_plan SET is_active = 0');
    const planId = (await db.run('INSERT INTO meal_plan (name) VALUES (?)', [name])).lastInsertRowId;
    let k = 0;
    for (const [pos, m] of meals.entries()) {
      const mealId = (await db.run('INSERT INTO meal (plan_id, weekday, label, position) VALUES (?, ?, ?, ?)', [planId, m.weekday, m.label, pos])).lastInsertRowId;
      for (const item of m.items) {
        const foodId = matches[k++];
        const food = foodId != null ? foods.get(foodId) : undefined;
        const grams = item.grams ?? (item.count ?? 1) * (food?.portionG ?? 100);
        await db.run('INSERT INTO meal_item (meal_id, food_id, raw_text, grams, match_confidence) VALUES (?, ?, ?, ?, ?)', [
          mealId, food?.id ?? null, item.raw.trim(), grams, food ? confidence(item.name, food.name) : 0,
        ]);
      }
    }
    return planId;
  });
}

export async function activePlan(db: Db): Promise<MealPlan | null> {
  const p = await db.get<{ id: number; name: string }>('SELECT id, name FROM meal_plan WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
  return p ? getPlan(db, p.id) : null;
}

export async function listPlans(db: Db): Promise<{ id: number; name: string; isActive: boolean }[]> {
  const rows = await db.all<{ id: number; name: string; is_active: number }>('SELECT id, name, is_active FROM meal_plan ORDER BY id DESC');
  return rows.map((r) => ({ id: r.id, name: r.name, isActive: !!r.is_active }));
}

export async function setActivePlan(db: Db, id: number): Promise<void> {
  await db.run('UPDATE meal_plan SET is_active = (id = ?)', [id]);
}

export async function deletePlan(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM meal_plan WHERE id = ?', [id]);
}

export async function getPlan(db: Db, id: number): Promise<MealPlan | null> {
  const p = await db.get<{ id: number; name: string }>('SELECT id, name FROM meal_plan WHERE id = ?', [id]);
  if (!p) return null;
  const meals = await db.all<{ id: number; weekday: number | null; label: string }>('SELECT id, weekday, label FROM meal WHERE plan_id = ? ORDER BY weekday, position', [id]);
  const items = await db.all<{ id: number; meal_id: number; food_id: number | null; raw_text: string; grams: number; match_confidence: number }>(
    `SELECT i.* FROM meal_item i JOIN meal m ON m.id = i.meal_id WHERE m.plan_id = ? ORDER BY i.id`,
    [id],
  );
  const foods = await foodsById(db, items.map((i) => i.food_id).filter((x): x is number => x != null));
  return {
    id: p.id,
    name: p.name,
    meals: meals.map((m) => ({
      id: m.id,
      weekday: m.weekday,
      label: m.label,
      items: items
        .filter((i) => i.meal_id === m.id)
        .map((i) => ({ id: i.id, mealId: i.meal_id, rawText: i.raw_text, grams: i.grams, confidence: i.match_confidence, food: i.food_id != null ? foods.get(i.food_id) ?? null : null })),
    })),
  };
}

/** Meals for a weekday: the day's own meals, or the undated meals if the plan has no days. */
export function mealsFor(plan: MealPlan, weekday: number): Meal[] {
  const own = plan.meals.filter((m) => m.weekday === weekday);
  return own.length ? own : plan.meals.filter((m) => m.weekday == null);
}

export async function updateMealItem(db: Db, id: number, patch: { foodId?: number; grams?: number }): Promise<void> {
  if (patch.foodId != null) await db.run('UPDATE meal_item SET food_id = ?, match_confidence = 1 WHERE id = ?', [patch.foodId, id]);
  if (patch.grams != null) await db.run('UPDATE meal_item SET grams = ? WHERE id = ?', [patch.grams, id]);
}

export async function deleteMealItem(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM meal_item WHERE id = ?', [id]);
}

export async function addMealItem(db: Db, mealId: number, food: Food, grams: number): Promise<void> {
  await db.run('INSERT INTO meal_item (meal_id, food_id, raw_text, grams, match_confidence) VALUES (?, ?, ?, ?, 1)', [mealId, food.id, food.name, grams]);
}

// ---------- food log ----------
export interface FoodLogEntry {
  id: number;
  day: string;
  grams: number;
  mealItemId: number | null;
  food: Food;
}

export async function logFood(db: Db, day: string, foodId: number, grams: number, mealItemId: number | null = null): Promise<void> {
  await db.run('INSERT INTO food_log (day, food_id, grams, meal_item_id) VALUES (?, ?, ?, ?)', [day, foodId, grams, mealItemId]);
}

export async function logMeal(db: Db, day: string, meal: Meal): Promise<void> {
  await db.tx(async () => {
    for (const i of meal.items) if (i.food) await logFood(db, day, i.food.id, i.grams, i.id);
  });
}

export async function deleteFoodLog(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM food_log WHERE id = ?', [id]);
}

export async function foodLogFor(db: Db, day: string): Promise<FoodLogEntry[]> {
  const rows = await db.all<{ id: number; day: string; grams: number; meal_item_id: number | null; food_id: number }>('SELECT * FROM food_log WHERE day = ? ORDER BY id', [day]);
  const foods = await foodsById(db, rows.map((r) => r.food_id));
  return rows.map((r) => ({ id: r.id, day: r.day, grams: r.grams, mealItemId: r.meal_item_id, food: foods.get(r.food_id)! })).filter((e) => e.food);
}

export async function kcalByDay(db: Db, from: string, to: string): Promise<Record<string, number>> {
  const rows = await db.all<{ day: string; kcal: number }>(
    'SELECT l.day, SUM(f.kcal * l.grams / 100) kcal FROM food_log l JOIN food f ON f.id = l.food_id WHERE l.day BETWEEN ? AND ? GROUP BY l.day',
    [from, to],
  );
  return Object.fromEntries(rows.map((r) => [r.day, r.kcal]));
}

export function totals(entries: { grams: number; food: Food | null }[]) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) {
    if (!e.food) continue;
    const k = e.grams / 100;
    t.kcal += e.food.kcal * k;
    t.protein += e.food.protein * k;
    t.carbs += e.food.carbs * k;
    t.fat += e.food.fat * k;
  }
  return t;
}

// ---------- targets ----------
export interface NutritionTarget {
  kcal: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  source: 'tdee' | 'manual';
}

export async function currentTarget(db: Db): Promise<NutritionTarget | null> {
  const r = await db.get<{ kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null; source: 'tdee' | 'manual' }>(
    'SELECT * FROM nutrition_target ORDER BY effective_from DESC, id DESC LIMIT 1',
  );
  return r ? { kcal: r.kcal, proteinG: r.protein_g, carbsG: r.carbs_g, fatG: r.fat_g, source: r.source } : null;
}

export async function setTarget(db: Db, day: string, t: NutritionTarget): Promise<void> {
  await db.run('INSERT INTO nutrition_target (effective_from, kcal, protein_g, carbs_g, fat_g, source) VALUES (?, ?, ?, ?, ?, ?)', [
    day, t.kcal, t.proteinG, t.carbsG, t.fatG, t.source,
  ]);
}
