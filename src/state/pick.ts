import { router } from 'expo-router';
import type { Exercise } from '../domain/types';

// One pending pick at a time; the picker screen resolves it and goes back.
let pending: ((ex: Exercise) => void) | null = null;

export function pickExercise(onPick: (ex: Exercise) => void, muscle?: string) {
  pending = onPick;
  router.push(muscle ? `/pick?muscle=${encodeURIComponent(muscle)}` : '/pick');
}

export function resolvePick(ex: Exercise) {
  const f = pending;
  pending = null;
  router.back();
  f?.(ex);
}
