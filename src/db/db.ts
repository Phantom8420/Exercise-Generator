export type SqlValue = string | number | null;

/** The subset of SQLite the app uses; implemented by expo-sqlite in the app and node:sqlite in tests. */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ lastInsertRowId: number; changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  tx<T>(fn: () => Promise<T>): Promise<T>;
}
