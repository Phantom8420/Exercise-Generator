export type UnitSystem = 'metric' | 'imperial';

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;

export const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

export function weightUnit(u: UnitSystem) {
  return u === 'metric' ? 'kg' : 'lb';
}
export function lengthUnit(u: UnitSystem) {
  return u === 'metric' ? 'cm' : 'in';
}

/** kg (storage) → display number */
export function displayWeight(kg: number, u: UnitSystem): number {
  return round(u === 'metric' ? kg : kgToLb(kg));
}
/** display number → kg (storage) */
export function storeWeight(v: number, u: UnitSystem): number {
  return u === 'metric' ? v : lbToKg(v);
}
export function displayLength(cm: number, u: UnitSystem): number {
  return round(u === 'metric' ? cm : cmToIn(cm));
}
export function storeLength(v: number, u: UnitSystem): number {
  return u === 'metric' ? v : inToCm(v);
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
