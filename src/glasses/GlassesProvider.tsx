import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useDb } from '../db/DbProvider';
import type { Db } from '../db/db';
import { getSetting, setSetting } from '../db/repo/core';
import { type DB, emptyDB, normalizeDB, purgeOldDoneTasks, runRecurring, seedDB } from './store';
import { todayISO } from './time';

// The whole Glasses document lives as one JSON value in Plasma's settings table.
const KEY = 'glasses.db';

async function load(db: Db): Promise<DB> {
  const raw = await getSetting(db, KEY);
  if (raw) {
    try {
      return normalizeDB(JSON.parse(raw));
    } catch {
      // keep the unreadable copy instead of overwriting it with seed data
      await setSetting(db, `${KEY}.corrupt`, raw);
    }
  }
  const fresh = seedDB();
  await setSetting(db, KEY, JSON.stringify(fresh));
  return fresh;
}

interface Value {
  data: DB;
  ready: boolean;
  /** Apply a store mutation to a cloned draft, persist, and re-render. */
  mutate: (fn: (draft: DB) => void) => void;
}

const Ctx = createContext<Value | null>(null);

export function GlassesProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const [data, setData] = useState<DB>(emptyDB);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    load(db)
      .then((loaded) => {
        if (!active) return;
        // daily housekeeping: post due recurring transactions, drop tasks done on earlier days
        const today = todayISO();
        if (runRecurring(loaded, today) + purgeOldDoneTasks(loaded, today) > 0) void setSetting(db, KEY, JSON.stringify(loaded));
        setData(loaded);
        setReady(true);
      })
      .catch((err) => {
        console.error('glasses load failed', err);
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [db]);

  const mutate = useCallback(
    (fn: (draft: DB) => void) => {
      setData((prev) => {
        const draft: DB = JSON.parse(JSON.stringify(prev));
        fn(draft);
        void setSetting(db, KEY, JSON.stringify(draft));
        return draft;
      });
    },
    [db],
  );

  return <Ctx.Provider value={{ data, ready, mutate }}>{children}</Ctx.Provider>;
}

export function useGlasses(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGlasses outside GlassesProvider');
  return v;
}
