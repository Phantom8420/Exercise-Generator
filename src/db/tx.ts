import type { Db, SqlValue } from './db';

type Base = Omit<Db, 'tx'>;

/** Adds BEGIN/COMMIT with nesting: inner tx() calls join the outer transaction. */
export function withTx(base: Base): Db {
  let depth = 0;
  return {
    ...base,
    async tx<T>(fn: () => Promise<T>): Promise<T> {
      if (depth > 0) return fn();
      depth++;
      await base.exec('BEGIN');
      try {
        const out = await fn();
        await base.exec('COMMIT');
        return out;
      } catch (e) {
        await base.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
  };
}

export type { SqlValue };
