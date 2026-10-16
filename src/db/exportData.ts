import type { Db } from './db';

/** Every user table as JSON. Bundled datasets are left out; custom foods are kept. */
export async function exportData(db: Db): Promise<{ app: 'plasma'; exportedAt: string; tables: Record<string, unknown[]> }> {
  const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const out: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    if (name === 'exercise') continue;
    out[name] = await db.all(name === 'food' ? "SELECT * FROM food WHERE source = 'custom'" : `SELECT * FROM "${name}"`);
  }
  return { app: 'plasma', exportedAt: new Date().toISOString(), tables: out };
}
