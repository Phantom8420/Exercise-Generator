import type { SQLiteDatabase } from 'expo-sqlite';
import type { Db } from './db';
import { withTx } from './tx';

export function expoDb(sql: SQLiteDatabase): Db {
  return withTx({
    exec: (s) => sql.execAsync(s),
    run: async (s, p = []) => {
      const r = await sql.runAsync(s, p);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    all: (s, p = []) => sql.getAllAsync(s, p),
    get: (s, p = []) => sql.getFirstAsync(s, p),
  });
}
