import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { Db } from '../db/db';
import { useDb } from '../db/DbProvider';
import { useApp } from '../state/app';

export interface Loadable<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
}

/** Loads on focus and after any write (see useWrite). */
export function useData<T>(load: (db: Db) => Promise<T>, deps: unknown[] = []): Loadable<T> {
  const db = useDb();
  const version = useApp((s) => s.version);
  const [state, setState] = useState<Loadable<T>>({ data: undefined, error: null, loading: true });
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setState((s) => ({ ...s, loading: true }));
      load(db).then(
        (data) => live && setState({ data, error: null, loading: false }),
        (error: Error) => live && setState({ data: undefined, error, loading: false }),
      );
      return () => {
        live = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, version, ...deps]),
  );
  return state;
}

export function useWrite() {
  const db = useDb();
  const bump = useApp((s) => s.bump);
  return useCallback(
    async <T,>(fn: (db: Db) => Promise<T>): Promise<T> => {
      const out = await fn(db);
      bump();
      return out;
    },
    [db, bump],
  );
}
