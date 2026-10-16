import type { Exercise } from '../domain/types';

export type Demo =
  | { kind: 'frames'; uris: string[]; frameMs: number }
  | { kind: 'video'; uri: string }
  | { kind: 'lottie'; uri: string };

/** Swap point for exercise media: replace the provider to move to video or Lottie without touching screens. */
export interface MediaProvider {
  demo(ex: Exercise): Demo | null;
  thumbnail(ex: Exercise): string | null;
}

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export const freeExerciseDb: MediaProvider = {
  demo: (ex) => (ex.images.length ? { kind: 'frames', uris: ex.images.map((p) => BASE + p), frameMs: 900 } : null),
  thumbnail: (ex) => (ex.images[0] ? BASE + ex.images[0] : null),
};

let provider: MediaProvider = freeExerciseDb;
export const media = () => provider;
export function setMediaProvider(p: MediaProvider) {
  provider = p;
}
