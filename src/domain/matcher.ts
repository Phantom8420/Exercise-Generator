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

export function matchFoods<T extends FoodName>(query: string, foods: T[], limit = 8): { food: T; score: number }[] {
  const q = tokens(query);
  const out: { food: T; score: number }[] = [];
  for (const f of foods) {
    const s = scoreFood(q, f.name);
    if (s > 0) out.push({ food: f, score: s });
  }
  return out.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length).slice(0, limit);
}

/** 0..1 confidence for UI sorting: full coverage with a head match is "sure". */
export function confidence(query: string, name: string): number {
  return Math.max(0, Math.min(1, scoreFood(tokens(query), name) / 12));
}
