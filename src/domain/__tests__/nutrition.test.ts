import { confidence, matchFoods } from '../matcher';
import { parseItem, parseMenu } from '../menu';
import { maximizeProtein, portionScale, suggestSwaps, type MenuItem } from '../optimizer';

describe('menu parsing', () => {
  it('items with grams, counts and trailing weights', () => {
    expect(parseItem('200g chicken breast')).toMatchObject({ name: 'chicken breast', grams: 200, count: null });
    expect(parseItem('- 3 eggs')).toMatchObject({ name: 'eggs', grams: null, count: 3 });
    expect(parseItem('rice 1.5 kg')).toMatchObject({ name: 'rice', grams: 1500 });
    expect(parseItem('oats')).toMatchObject({ name: 'oats', grams: null, count: null });
  });

  it('free text with days and meals', () => {
    const meals = parseMenu(`Monday
Breakfast: 3 eggs, 80g oats
Dinner:
- 250 g chicken breast
- 200g rice
Tuesday: 1 banana`);
    expect(meals.map((m) => [m.weekday, m.label, m.items.length])).toEqual([
      [0, 'Breakfast', 2],
      [0, 'Dinner', 2],
      [1, 'Meal', 1],
    ]);
  });

  it('one meal a day is a valid menu', () => {
    expect(parseMenu('OMAD: 500g beef, 400g potatoes')).toHaveLength(1);
  });

  it('CSV', () => {
    const meals = parseMenu('day,meal,food,grams\nMon,Lunch,chicken breast,200\nMon,Lunch,"rice, white",150\nTue,Dinner,salmon,180');
    expect(meals).toHaveLength(2);
    expect(meals[0].items[1]).toMatchObject({ name: 'rice, white', grams: 150 });
  });

  it('CSV header without a food column falls back to free text', () => {
    expect(parseMenu('day,meal\nMon,Lunch')[0].items[0].name).toBe('day');
  });
});

describe('matcher', () => {
  const foods = [
    { id: 1, name: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted' },
    { id: 2, name: 'Egg, whole, raw, fresh' },
    { id: 3, name: 'Soup, chicken noodle, canned' },
    { id: 4, name: 'Rice, white, long-grain, regular, cooked' },
  ];

  it('ranks the obvious match first', () => {
    expect(matchFoods('chicken breast', foods)[0].food.id).toBe(1);
    expect(matchFoods('eggs', foods)[0].food.id).toBe(2);
    expect(matchFoods('white rice', foods)[0].food.id).toBe(4);
  });

  it('no overlap → no match', () => {
    expect(matchFoods('tofu', foods)).toEqual([]);
    expect(confidence('tofu', foods[0].name)).toBe(0);
  });
});

describe('optimizer', () => {
  const item = (key: string, kcal: number, protein: number, grams: number, minG = 0, maxG = grams * 2, category = 'x'): MenuItem => ({
    key, name: key, category, kcalPer100: kcal, proteinPer100: protein, grams, minG, maxG,
  });

  const menu = [item('chicken', 165, 31, 150), item('rice', 130, 2.7, 200), item('eggs', 143, 12.6, 100), item('oil', 884, 0, 10)];

  /** Brute force over a 1 g grid is too slow; 5 g steps over small ranges is enough to check optimality. */
  function brute(items: MenuItem[], budget: number): number {
    let best = 0;
    const rec = (i: number, kcal: number, protein: number) => {
      if (kcal > budget + 1e-9) return;
      if (i === items.length) {
        best = Math.max(best, protein);
        return;
      }
      const it = items[i];
      for (let g = it.minG; g <= it.maxG; g += 5) rec(i + 1, kcal + (it.kcalPer100 * g) / 100, protein + (it.proteinPer100 * g) / 100);
    };
    rec(0, 0, 0);
    return best;
  }

  it('is at least as good as brute force', () => {
    const small = [item('chicken', 165, 31, 50), item('rice', 130, 2.7, 50), item('eggs', 143, 12.6, 50)];
    for (const budget of [100, 250, 400]) {
      expect(maximizeProtein(small, budget).protein).toBeGreaterThanOrEqual(brute(small, budget) - 0.1);
    }
  });

  it('respects budget and bounds, and explains each step', () => {
    const res = maximizeProtein(menu, 800);
    expect(res.kcal).toBeLessThanOrEqual(800);
    expect(res.grams.chicken).toBeLessThanOrEqual(300);
    expect(res.trace[0].name).toBe('chicken');
    expect(res.trace[0].reason).toMatch(/best ratio/);
  });

  it('reports when minimum portions alone exceed the budget', () => {
    const res = maximizeProtein([item('chicken', 165, 31, 200, 200, 400)], 100);
    expect(res.overBudgetAtMinimum).toBe(true);
    expect(res.grams.chicken).toBe(200);
  });

  it('swaps suggest higher protein density in the same category', () => {
    const swaps = suggestSwaps(item('beef', 250, 26, 100, 0, 200, 'meat'), [
      { key: 'chicken', name: 'chicken', category: 'meat', kcalPer100: 165, proteinPer100: 31 },
      { key: 'bacon', name: 'bacon', category: 'meat', kcalPer100: 540, proteinPer100: 37 },
      { key: 'whey', name: 'whey', category: 'supplement', kcalPer100: 380, proteinPer100: 80 },
    ]);
    expect(swaps.map((s) => s.key)).toEqual(['chicken']);
    expect(swaps[0].proteinGain).toBeGreaterThan(0);
  });
});

it('scales remaining portions to what is left of the day', () => {
  expect(portionScale(600, 1200)).toBe(0.5);
  expect(portionScale(-100, 800)).toBe(0);
  expect(portionScale(500, 0)).toBeNull();
});
