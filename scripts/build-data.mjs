// Builds the bundled datasets in src/data from upstream downloads.
// Usage: node scripts/build-data.mjs <free-exercise-db exercises.json> <USDA SR Legacy csv dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [exercisesPath, usdaDir] = process.argv.slice(2);
if (!exercisesPath || !usdaDir) {
  console.error('usage: node scripts/build-data.mjs <exercises.json> <usda csv dir>');
  process.exit(1);
}

// --- exercises (free-exercise-db, Unlicense) ---
const raw = JSON.parse(readFileSync(exercisesPath, 'utf8'));
const exercises = raw.map((e) => ({
  id: e.id,
  name: e.name,
  force: e.force ?? null,
  level: e.level,
  mechanic: e.mechanic ?? null,
  equipment: e.equipment ?? 'body only',
  primary: e.primaryMuscles,
  secondary: e.secondaryMuscles,
  instructions: e.instructions,
  category: e.category,
  images: e.images,
}));
writeFileSync('src/data/exercises.json', JSON.stringify(exercises));
console.log(`exercises: ${exercises.length}`);

// --- foods (USDA FoodData Central SR Legacy, public domain) ---
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.slice(1);
}
const csv = (f) => parseCsv(readFileSync(join(usdaDir, f), 'utf8'));

const categories = new Map(csv('food_category.csv').map(([id, , d]) => [id, d]));
const NUTRIENTS = { '1008': 'kcal', '1003': 'p', '1005': 'c', '1004': 'f' };
const nutr = new Map();
for (const [, fdc, nid, amount] of csv('food_nutrient.csv')) {
  const key = NUTRIENTS[nid];
  if (!key) continue;
  if (!nutr.has(fdc)) nutr.set(fdc, {});
  nutr.get(fdc)[key] = Number(amount);
}
const portions = new Map();
for (const [, fdc, seq, amount, , desc, modifier, grams] of csv('food_portion.csv')) {
  if (portions.has(fdc) && seq !== '1') continue;
  const label = [amount, desc || modifier].filter(Boolean).join(' ').trim();
  portions.set(fdc, [Number(grams), label]);
}
const r1 = (n) => Math.round((n ?? 0) * 10) / 10;
const foods = [];
for (const [fdc, , name, cat] of csv('food.csv')) {
  const n = nutr.get(fdc);
  if (!n || n.kcal == null) continue;
  const [g, label] = portions.get(fdc) ?? [100, '100 g'];
  // [fdcId, name, category, kcal, protein, carbs, fat (per 100 g), portion g, portion label]
  foods.push([Number(fdc), name, categories.get(cat) ?? 'Other', r1(n.kcal), r1(n.p), r1(n.c), r1(n.f), g, label]);
}
writeFileSync('src/data/foods.json', JSON.stringify(foods));
console.log(`foods: ${foods.length}`);
