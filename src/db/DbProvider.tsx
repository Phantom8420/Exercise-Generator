import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useApp } from '../state/app';
import type { Db } from './db';
import { expoDb } from './expo';
import { migrate } from './migrations';
import { getSetting } from './repo/core';
import { settleDebts } from './repo/debts';
import { seedExercises, seedFoods } from './seed';

async function init(sql: SQLiteDatabase) {
  const db = expoDb(sql);
  await migrate(db);
  await seedExercises(db, require('../data/exercises.json'));
  await seedFoods(db, require('../data/foods.json'));
  const [units, theme] = await Promise.all([getSetting(db, 'units'), getSetting(db, 'theme')]);
  useApp.getState().set({
    ...(units === 'metric' || units === 'imperial' ? { units } : {}),
    ...(theme === 'light' || theme === 'dark' || theme === 'system' ? { theme } : {}),
  });
  await settleDebts(db);
}

const Ctx = createContext<Db | null>(null);

function Bridge({ children }: { children: ReactNode }) {
  const sql = useSQLiteContext();
  const db = useMemo(() => expoDb(sql), [sql]);
  return <Ctx.Provider value={db}>{children}</Ctx.Provider>;
}

export function DbProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName="plasma.db" onInit={init} useSuspense>
      <Bridge>{children}</Bridge>
    </SQLiteProvider>
  );
}

export function useDb(): Db {
  const db = useContext(Ctx);
  if (!db) throw new Error('useDb outside DbProvider');
  return db;
}
