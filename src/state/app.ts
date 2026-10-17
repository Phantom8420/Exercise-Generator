import { create } from 'zustand';
import type { UnitSystem } from '../domain/units';

export type ThemePref = 'system' | 'light' | 'dark';

/** Ephemeral UI state only; anything durable lives in SQLite. `version` bumps after writes so screens reload. */
interface AppState {
  units: UnitSystem;
  theme: ThemePref;
  version: number;
  set: (p: Partial<Pick<AppState, 'units' | 'theme'>>) => void;
  bump: () => void;
}

export const useApp = create<AppState>((set) => ({
  units: 'metric',
  theme: 'dark',
  version: 0,
  set: (p) => set(p),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
