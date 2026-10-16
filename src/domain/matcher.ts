export interface FoodName {
  id: number;
  name: string;
}

const STOP = new Set(['of', 'and', 'with', 'the', 'a', 'an', 'in', 'or']);
// Plural/singular noise is the most common miss ("eggs" vs "Egg").
const stem = (w: string) => (w.length > 3 && w.endsWith('es') && !w.endsWith('ses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

/**
 * Token-overlap score against USDA-style names ("Chicken, broilers or fryers, breast, …").
 * Query coverage dominates; matching the first name segment, "raw"/"cooked" hints and
 * shorter names break ties.
 */
export function scoreFood(query: string[], name: string): number {
  if (!query.length) return 0;
  const nameTokens = tokens(name);
  const set = new Set(nameTokens);
  const head = new Set(tokens(name.split(',')[0]));
  let hit = 0;
  let headHit = 0;
  for (const q of query) {
    if (set.has(q)) hit++;
    else if (nameTokens.some((t) => t.startsWith(q) && q.length >= 3)) hit += 0.6;
    if (head.has(q)) headHit++;
  }
  const coverage = hit / query.length;
  if (coverage === 0) return 0;
  return coverage * 10 + headHit * 2 - nameTokens.length * 0.08;
}

// What people usually mean by a bare food word; keyed by the stemmed query tokens.
const COMMON: Record<string, string> = {
  egg: 'Egg, whole, raw, fresh',
  'whole egg': 'Egg, whole, raw, fresh',
  milk: 'Milk, whole, 3.25% milkfat, with added vitamin D',
  rice: 'Rice, white, long-grain, regular, enriched, cooked',
  'white rice': 'Rice, white, long-grain, regular, enriched, cooked',
  oat: 'Cereals, oats, regular and quick, not fortified, dry',
  oatmeal: 'Cereals, oats, regular and quick, not fortified, dry',
  banana: 'Bananas, raw',
  'chicken breast': 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
  chicken: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
  salmon: 'Fish, salmon, Atlantic, farmed, cooked, dry heat',
  beef: 'Beef, ground, 80% lean meat / 20% fat, raw',
  'ground beef': 'Beef, ground, 80% lean meat / 20% fat, raw',
  potato: 'Potatoes, boiled, cooked without skin, flesh, without salt',
  'sweet potato': 'Sweet potato, cooked, baked in skin, flesh, without salt',
  bread: 'Bread, whole-wheat, commercially prepared',
  pasta: 'Pasta, cooked, enriched, without added salt',
  yogurt: 'Yogurt, Greek, plain, lowfat',
  'greek yogurt': 'Yogurt, Greek, plain, lowfat',
  tuna: 'Fish, tuna, light, canned in water, without salt, drained solids',
  'peanut butter': 'Peanut butter, smooth style, without salt',
  apple: "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)",
  broccoli: 'Broccoli, raw',
  'olive oil': 'Oil, olive, salad or cooking',
  tofu: 'Tofu, raw, firm, prepared with calcium sulfate',
  lentil: 'Lentils, mature seeds, cooked, boiled, without salt',
  'turkey breast': 'Turkey, retail parts, breast, meat only, cooked, roasted',
  cheese: 'Cheese, cheddar, sharp, sliced',
  butter: 'Butter, salted',
  'cottage cheese': 'Cheese, cottage, lowfat, 2% milkfat',
  whey: 'Beverages, Protein powder whey based',
  'whey protein': 'Beverages, Protein powder whey based',
  avocado: 'Avocados, raw, all commercial varieties',
  spinach: 'Spinach, raw',
  almond: 'Nuts, almonds',
  orange: 'Oranges, raw, all commercial varieties',
};
// Processed or unusual variants lose to the plain food unless the query asks for them.
const NICHE = new Set(tokens('dried dehydrated powder frozen breaded canned nugget cracker sheep goat babyfood infant alaska native imitation flavored'));

export function matchFoods<T extends FoodName>(query: string, foods: T[], limit = 8): { food: T; score: number }[] {
  const q = tokens(query);
  const usual = COMMON[q.join(' ')];
  const out: { food: T; score: number }[] = [];
  for (const f of foods) {
    let s = f.name === usual ? 100 : scoreFood(q, f.name);
    if (s <= 0) continue;
    for (const t of tokens(f.name)) if (NICHE.has(t) && !q.includes(t)) s -= 1.5;
    out.push({ food: f, score: s });
  }
  return out.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length).slice(0, limit);
}

/** 0..1 confidence for UI sorting: full coverage with a head match is "sure". */
export function confidence(query: string, name: string): number {
  return Math.max(0, Math.min(1, scoreFood(tokens(query), name) / 12));
}
