export interface MenuItem {
  key: string;
  name: string;
  category: string;
  kcalPer100: number;
  proteinPer100: number;
  grams: number;
  minG: number;
  maxG: number;
}

export interface TraceStep {
  key: string;
  name: string;
  fromG: number;
  toG: number;
  deltaProtein: number;
  deltaKcal: number;
  reason: string;
}

export interface OptimizeResult {
  grams: Record<string, number>;
  kcal: number;
  protein: number;
  trace: TraceStep[];
  /** True when even minimum portions exceed the budget; portions stay at minimum. */
  overBudgetAtMinimum: boolean;
}

const kcal = (i: MenuItem, g: number) => (i.kcalPer100 * g) / 100;
const prot = (i: MenuItem, g: number) => (i.proteinPer100 * g) / 100;
const r = (n: number) => Math.round(n * 10) / 10;

/**
 * Maximise protein subject to Σkcal ≤ budget and minG ≤ grams ≤ maxG.
 * One budget constraint with continuous portions is a fractional knapsack, so filling
 * by protein-per-kcal (highest first) is optimal.
 */
export function maximizeProtein(items: MenuItem[], kcalBudget: number): OptimizeResult {
  const grams: Record<string, number> = {};
  const trace: TraceStep[] = [];
  let usedKcal = 0;
  for (const i of items) {
    grams[i.key] = i.minG;
    usedKcal += kcal(i, i.minG);
  }
  const overBudgetAtMinimum = usedKcal > kcalBudget;

  const ratio = (i: MenuItem) => (i.kcalPer100 <= 0 ? Infinity : i.proteinPer100 / i.kcalPer100);
  const order = items.filter((i) => i.proteinPer100 > 0).sort((a, b) => ratio(b) - ratio(a));

  for (const i of order) {
    const room = i.maxG - i.minG;
    if (room <= 0) continue;
    const budgetLeft = kcalBudget - usedKcal;
    const addG = i.kcalPer100 <= 0 ? room : Math.min(room, Math.max(0, (budgetLeft * 100) / i.kcalPer100));
    if (addG <= 0) continue;
    grams[i.key] = i.minG + addG;
    usedKcal += kcal(i, addG);
    trace.push({
      key: i.key,
      name: i.name,
      fromG: i.minG,
      toG: r(i.minG + addG),
      deltaProtein: r(prot(i, addG)),
      deltaKcal: r(kcal(i, addG)),
      reason:
        `${r(ratio(i) * 100)} g protein per 100 kcal, best ratio left` +
        (addG < room ? '; stopped at the calorie budget' : '; at max portion'),
    });
  }

  const protein = items.reduce((s, i) => s + prot(i, grams[i.key]), 0);
  for (const k of Object.keys(grams)) grams[k] = r(grams[k]);
  return { grams, kcal: r(usedKcal), protein: r(protein), trace, overBudgetAtMinimum };
}

export interface SwapCandidate {
  key: string;
  name: string;
  category: string;
  kcalPer100: number;
  proteinPer100: number;
}

/** Same-category foods with more protein per kcal; delta shown at equal calories. */
export function suggestSwaps(item: MenuItem, candidates: SwapCandidate[], limit = 3) {
  const base = item.kcalPer100 > 0 ? item.proteinPer100 / item.kcalPer100 : 0;
  const itemKcal = kcal(item, item.grams);
  return candidates
    .filter((c) => c.category === item.category && c.key !== item.key && c.kcalPer100 > 0 && c.proteinPer100 / c.kcalPer100 > base)
    .map((c) => {
      const g = itemKcal > 0 ? (itemKcal * 100) / c.kcalPer100 : item.grams;
      return { ...c, grams: r(g), proteinGain: r(prot({ ...item, proteinPer100: c.proteinPer100 }, g) - prot(item, item.grams)) };
    })
    .sort((a, b) => b.proteinGain - a.proteinGain)
    .slice(0, limit);
}

/**
 * How much of the usual portions to eat at the meals still ahead so the day lands on target.
 * 1 = as planned, 0.5 = half. Null when no meals are left to adjust.
 */
export function portionScale(kcalLeft: number, upcomingKcal: number): number | null {
  if (upcomingKcal <= 0) return null;
  return Math.max(0, kcalLeft / upcomingKcal);
}
