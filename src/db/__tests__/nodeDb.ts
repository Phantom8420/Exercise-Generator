import { DatabaseSync } from 'node:sqlite';
import type { Db, SqlValue } from '../db';
import { migrate } from '../migrations';
import { withTx } from '../tx';

export function nodeDb(): Db {
  const sql = new DatabaseSync(':memory:');
  return withTx({
    exec: async (s) => void sql.exec(s),
    run: async (s, p: SqlValue[] = []) => {
      const r = sql.prepare(s).run(...p);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    all: async <T,>(s: string, p: SqlValue[] = []) => sql.prepare(s).all(...p) as T[],
    get: async <T,>(s: string, p: SqlValue[] = []) => (sql.prepare(s).get(...p) as T | undefined) ?? null,
  });
}

export async function freshDb(): Promise<Db> {
  const db = nodeDb();
  await migrate(db);
  return db;
}
