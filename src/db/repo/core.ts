import type { Equipment, Experience, Goal, Sex } from '../../domain/types';
import type { Db } from '../db';

// ---------- settings ----------
export async function getSetting(db: Db, key: string): Promise<string | null> {
  const r = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r?.value ?? null;
}
export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value]);
}

// ---------- user ----------
export interface User {
  name: string | null;
  sex: Sex;
  birthDate: string | null;
  heightCm: number | null;
  goal: Goal;
  experience: Experience;
  recovery: number;
  activityFactor: number;
  paceKgWeek: number | null;
  targetBfPct: number | null;
  targetDate: string | null;
}

export async function getUser(db: Db): Promise<User> {
  const r = await db.get<{
    name: string | null; sex: Sex; birth_date: string | null; height_cm: number | null; goal: Goal;
    experience: Experience; recovery: number; activity_factor: number; pace_kg_week: number | null;
    target_bf_pct: number | null; target_date: string | null;
  }>('SELECT * FROM user WHERE id = 1');
  if (!r) throw new Error('user row missing; migrations did not run');
  return {
    name: r.name, sex: r.sex, birthDate: r.birth_date, heightCm: r.height_cm, goal: r.goal, experience: r.experience,
    recovery: r.recovery, activityFactor: r.activity_factor, paceKgWeek: r.pace_kg_week,
    targetBfPct: r.target_bf_pct, targetDate: r.target_date,
  };
}

const USER_COLS: Record<keyof User, string> = {
  name: 'name', sex: 'sex', birthDate: 'birth_date', heightCm: 'height_cm', goal: 'goal', experience: 'experience',
  recovery: 'recovery', activityFactor: 'activity_factor', paceKgWeek: 'pace_kg_week',
  targetBfPct: 'target_bf_pct', targetDate: 'target_date',
};

export async function updateUser(db: Db, patch: Partial<User>): Promise<void> {
  const keys = Object.keys(patch) as (keyof User)[];
  if (!keys.length) return;
  await db.run(
    `UPDATE user SET ${keys.map((k) => `${USER_COLS[k]} = ?`).join(', ')} WHERE id = 1`,
    keys.map((k) => (patch[k] ?? null) as string | number | null),
  );
}

// ---------- body metrics ----------
export interface BodyMetric {
  id: number;
  measuredOn: string;
  weightKg: number | null;
  waistCm: number | null;
  neckCm: number | null;
  hipCm: number | null;
  bodyFatPct: number | null;
  bodyFatSource: 'navy' | 'manual' | null;
}

export async function addBodyMetric(db: Db, m: Omit<BodyMetric, 'id'>): Promise<void> {
  await db.run(
    'INSERT INTO body_metric (measured_on, weight_kg, waist_cm, neck_cm, hip_cm, body_fat_pct, body_fat_source) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [m.measuredOn, m.weightKg, m.waistCm, m.neckCm, m.hipCm, m.bodyFatPct, m.bodyFatSource],
  );
}

export async function listBodyMetrics(db: Db): Promise<BodyMetric[]> {
  const rows = await db.all<{
    id: number; measured_on: string; weight_kg: number | null; waist_cm: number | null; neck_cm: number | null;
    hip_cm: number | null; body_fat_pct: number | null; body_fat_source: 'navy' | 'manual' | null;
  }>('SELECT * FROM body_metric ORDER BY measured_on, id');
  return rows.map((r) => ({
    id: r.id, measuredOn: r.measured_on, weightKg: r.weight_kg, waistCm: r.waist_cm, neckCm: r.neck_cm, hipCm: r.hip_cm,
    bodyFatPct: r.body_fat_pct, bodyFatSource: r.body_fat_source,
  }));
}

export async function deleteBodyMetric(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM body_metric WHERE id = ?', [id]);
}

export async function latestWeightKg(db: Db): Promise<number | null> {
  const r = await db.get<{ w: number }>('SELECT weight_kg w FROM body_metric WHERE weight_kg IS NOT NULL ORDER BY measured_on DESC, id DESC LIMIT 1');
  return r?.w ?? null;
}

// ---------- equipment ----------
export interface EquipmentProfile {
  id: number;
  name: string;
  isActive: boolean;
  items: Equipment[];
}

export async function listProfiles(db: Db): Promise<EquipmentProfile[]> {
  const profiles = await db.all<{ id: number; name: string; is_active: number }>('SELECT * FROM equipment_profile ORDER BY id');
  const items = await db.all<{ profile_id: number; equipment: Equipment }>('SELECT * FROM equipment_item');
  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    isActive: !!p.is_active,
    items: items.filter((i) => i.profile_id === p.id).map((i) => i.equipment),
  }));
}

export async function activeEquipment(db: Db): Promise<Equipment[]> {
  const rows = await db.all<{ equipment: Equipment }>(
    'SELECT i.equipment FROM equipment_item i JOIN equipment_profile p ON p.id = i.profile_id WHERE p.is_active = 1',
  );
  return rows.map((r) => r.equipment);
}

export async function setActiveProfile(db: Db, id: number): Promise<void> {
  await db.run('UPDATE equipment_profile SET is_active = (id = ?)', [id]);
}

export async function toggleEquipment(db: Db, profileId: number, eq: Equipment, on: boolean): Promise<void> {
  if (on) await db.run('INSERT OR IGNORE INTO equipment_item (profile_id, equipment) VALUES (?, ?)', [profileId, eq]);
  else await db.run('DELETE FROM equipment_item WHERE profile_id = ? AND equipment = ?', [profileId, eq]);
}

export async function createProfile(db: Db, name: string): Promise<number> {
  return (await db.run('INSERT INTO equipment_profile (name) VALUES (?)', [name])).lastInsertRowId;
}

export async function deleteProfile(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM equipment_profile WHERE id = ?', [id]);
}
