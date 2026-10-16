import { LEVEL_WEIGHT } from './training';
import type { Exercise } from './types';

/** Same primary muscle required; mechanic, force, level and secondary overlap break ties. */
export function findSubstitutes(target: Exercise, pool: Exercise[], available: ReadonlySet<string>, limit = 5): Exercise[] {
  const scored: { e: Exercise; s: number }[] = [];
  for (const e of pool) {
    if (e.id === target.id || e.primary[0] !== target.primary[0]) continue;
    if (e.equipment !== 'body only' && !available.has(e.equipment)) continue;
    let s = 0;
    if (e.mechanic === target.mechanic) s += 2;
    if (e.force === target.force) s += 1;
    s -= Math.abs(LEVEL_WEIGHT[e.level] - LEVEL_WEIGHT[target.level]) * 2;
    s += 0.5 * e.secondary.filter((m) => target.secondary.includes(m)).length;
    scored.push({ e, s });
  }
  return scored
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((x) => x.e);
}

/**
 * How much one unit of `to` repays one unit owed of `from`.
 * Harder substitutes repay more per rep: factor = level weight(to) / level weight(from).
 */
export function equivalenceFactor(from: Exercise, to: Exercise): number {
  if (from.id === to.id) return 1;
  return LEVEL_WEIGHT[to.level] / LEVEL_WEIGHT[from.level];
}
