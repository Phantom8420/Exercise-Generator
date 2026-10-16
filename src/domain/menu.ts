export interface ParsedItem {
  raw: string;
  name: string;
  /** Explicit weight in grams, when the line gave one. */
  grams: number | null;
  /** Count of default portions ("3 eggs"), when no weight was given. */
  count: number | null;
}

export interface ParsedMeal {
  weekday: number | null; // 0 = Monday
  label: string;
  items: ParsedItem[];
}

const DAYS: Record<string, number> = {
  mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1, wed: 2, wednesday: 2, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6,
};
const MEAL_WORDS = /^(breakfast|brunch|lunch|dinner|supper|snack|snacks|meal\s*\d+|pre[- ]?workout|post[- ]?workout|omad)$/i;
const UNIT_G: Record<string, number> = { g: 1, gr: 1, gram: 1, grams: 1, kg: 1000, oz: 28.35, lb: 453.6, lbs: 453.6, ml: 1, l: 1000 };

export function parseDayName(s: string): number | null {
  return DAYS[s.trim().toLowerCase().replace(/[:.]$/, '')] ?? null;
}

export function parseItem(raw: string): ParsedItem | null {
  const text = raw.replace(/^[-*•\s]+/, '').trim();
  if (!text) return null;
  // "200g chicken", "200 g chicken", "chicken 200g", "3 eggs", "1.5 lb beef"
  const lead = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\b\s*(?:of\s+)?(.*)$/);
  if (lead) {
    const n = Number(lead[1].replace(',', '.'));
    const unit = lead[2]?.toLowerCase();
    if (unit && UNIT_G[unit] && lead[3]) return { raw, name: lead[3].trim(), grams: n * UNIT_G[unit], count: null };
    const rest = [lead[2], lead[3]].filter(Boolean).join(' ').trim();
    if (rest) return { raw, name: rest, grams: null, count: n };
  }
  const trail = text.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)$/);
  if (trail && UNIT_G[trail[3].toLowerCase()]) {
    return { raw, name: trail[1].trim(), grams: Number(trail[2].replace(',', '.')) * UNIT_G[trail[3].toLowerCase()], count: null };
  }
  return { raw, name: text, grams: null, count: null };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** CSV with a header containing at least `food`; optional day, meal, grams, quantity. */
export function parseMenuCsv(text: string): ParsedMeal[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iFood = col('food', 'item', 'name');
  if (iFood < 0) throw new Error('CSV needs a "food" column.');
  const iDay = col('day', 'weekday');
  const iMeal = col('meal', 'label');
  const iGrams = col('grams', 'g', 'weight');
  const iQty = col('quantity', 'qty', 'count', 'servings');

  const meals = new Map<string, ParsedMeal>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const food = cells[iFood];
    if (!food) continue;
    const weekday = iDay >= 0 ? parseDayName(cells[iDay] ?? '') : null;
    const label = (iMeal >= 0 && cells[iMeal]) || 'Meal';
    const key = `${weekday}|${label}`;
    if (!meals.has(key)) meals.set(key, { weekday, label, items: [] });
    const g = iGrams >= 0 && cells[iGrams] ? Number(cells[iGrams]) : null;
    const c = iQty >= 0 && cells[iQty] ? Number(cells[iQty]) : null;
    const parsed = g == null && c == null ? parseItem(food) : { raw: line, name: food, grams: g, count: c };
    if (parsed) meals.get(key)!.items.push(parsed);
  }
  return [...meals.values()];
}

/**
 * Free text: day headers ("Monday", "Tue:"), meal headers ("Lunch:" optionally followed by
 * items on the same line), and items separated by newlines, commas or "+".
 */
export function parseMenuText(text: string): ParsedMeal[] {
  const meals: ParsedMeal[] = [];
  let weekday: number | null = null;
  let current: ParsedMeal | null = null;

  const pushItems = (chunk: string) => {
    for (const part of chunk.split(/,|\+|;/)) {
      const item = parseItem(part);
      if (!item) continue;
      if (!current) {
        current = { weekday, label: 'Meal', items: [] };
        meals.push(current);
      }
      current.items.push(item);
    }
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const [head, ...restParts] = line.split(':');
    const rest = restParts.join(':').trim();
    const day = parseDayName(head);
    if (day !== null) {
      weekday = day;
      current = null;
      if (rest) pushItems(rest);
      continue;
    }
    if (MEAL_WORDS.test(head.trim())) {
      current = { weekday, label: head.trim().replace(/^\w/, (c) => c.toUpperCase()), items: [] };
      meals.push(current);
      if (rest) pushItems(rest);
      continue;
    }
    pushItems(line);
  }
  return meals.filter((m) => m.items.length);
}

export function parseMenu(text: string): ParsedMeal[] {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return /(^|,)\s*"?(food|item|name)"?\s*(,|$)/i.test(first) ? parseMenuCsv(text) : parseMenuText(text);
}
