import type { Db } from './db';

/** Append-only. Never edit a shipped migration; add a new one. Index = target user_version − 1. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE user (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    sex TEXT NOT NULL DEFAULT 'male',
    birth_date TEXT,
    height_cm REAL,
    goal TEXT NOT NULL DEFAULT 'gain_muscle',
    experience TEXT NOT NULL DEFAULT 'intermediate',
    recovery INTEGER NOT NULL DEFAULT 3,
    activity_factor REAL NOT NULL DEFAULT 1.55,
    pace_kg_week REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT INTO user (id) VALUES (1);

  CREATE TABLE body_metric (
    id INTEGER PRIMARY KEY,
    measured_on TEXT NOT NULL,
    weight_kg REAL,
    waist_cm REAL,
    neck_cm REAL,
    hip_cm REAL,
    body_fat_pct REAL,
    body_fat_source TEXT
  );
  CREATE INDEX body_metric_day ON body_metric (measured_on);

  CREATE TABLE equipment_profile (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE equipment_item (
    profile_id INTEGER NOT NULL REFERENCES equipment_profile (id) ON DELETE CASCADE,
    equipment TEXT NOT NULL,
    PRIMARY KEY (profile_id, equipment)
  );
  INSERT INTO equipment_profile (id, name, is_active) VALUES (1, 'Full gym', 1), (2, 'Home', 0);
  INSERT INTO equipment_item (profile_id, equipment) VALUES
    (1, 'barbell'), (1, 'dumbbell'), (1, 'cable'), (1, 'machine'), (1, 'kettlebells'), (1, 'bands'), (1, 'e-z curl bar'),
    (2, 'dumbbell'), (2, 'bands');

  CREATE TABLE exercise (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    primary_muscles TEXT NOT NULL,
    secondary_muscles TEXT NOT NULL,
    primary_muscle TEXT NOT NULL,
    equipment TEXT NOT NULL,
    mechanic TEXT,
    force TEXT,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    instructions TEXT NOT NULL,
    mistakes TEXT NOT NULL DEFAULT '[]',
    images TEXT NOT NULL,
    source TEXT NOT NULL,
    source_ref TEXT,
    is_custom INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX exercise_muscle ON exercise (primary_muscle);
  CREATE INDEX exercise_equipment ON exercise (equipment);

  CREATE TABLE routine (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    split TEXT NOT NULL,
    goal TEXT NOT NULL,
    is_generated INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 0,
    generator_inputs TEXT,
    explanation TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE routine_day (
    id INTEGER PRIMARY KEY,
    routine_id INTEGER NOT NULL REFERENCES routine (id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    label TEXT NOT NULL,
    intensity TEXT NOT NULL DEFAULT 'moderate',
    session_minutes INTEGER NOT NULL DEFAULT 60,
    UNIQUE (routine_id, weekday)
  );
  CREATE TABLE routine_exercise (
    id INTEGER PRIMARY KEY,
    routine_day_id INTEGER NOT NULL REFERENCES routine_day (id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercise (id),
    position INTEGER NOT NULL,
    sets INTEGER NOT NULL,
    rep_min INTEGER NOT NULL,
    rep_max INTEGER NOT NULL,
    rest_s INTEGER NOT NULL,
    target_weight_kg REAL
  );

  CREATE TABLE workout_session (
    id INTEGER PRIMARY KEY,
    routine_day_id INTEGER REFERENCES routine_day (id) ON DELETE SET NULL,
    day TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    notes TEXT
  );
  CREATE INDEX session_day ON workout_session (day);
  CREATE TABLE logged_set (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES workout_session (id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercise (id),
    day TEXT NOT NULL,
    set_index INTEGER NOT NULL,
    weight_kg REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL,
    debt_id INTEGER REFERENCES debt (id) ON DELETE SET NULL,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX logged_set_day ON logged_set (day);
  CREATE INDEX logged_set_exercise ON logged_set (exercise_id);

  CREATE TABLE challenge (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    target REAL NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    exercise_ids TEXT,
    muscles TEXT,
    count_bodyweight INTEGER NOT NULL DEFAULT 0,
    daily_kcal REAL,
    kcal_mode TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE debt (
    id INTEGER PRIMARY KEY,
    exercise_id TEXT NOT NULL REFERENCES exercise (id),
    muscle TEXT NOT NULL,
    metric TEXT NOT NULL,
    owed REAL NOT NULL,
    repaid REAL NOT NULL DEFAULT 0,
    created_for TEXT NOT NULL,
    daily_cap REAL,
    cap_mode TEXT NOT NULL DEFAULT 'default',
    status TEXT NOT NULL DEFAULT 'open',
    UNIQUE (exercise_id, created_for)
  );
  CREATE TABLE debt_allocation (
    debt_id INTEGER NOT NULL REFERENCES debt (id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    amount REAL NOT NULL,
    PRIMARY KEY (debt_id, day)
  );

  CREATE TABLE food (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    source_ref TEXT,
    category TEXT NOT NULL,
    kcal REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    portion_g REAL NOT NULL DEFAULT 100,
    portion_label TEXT NOT NULL DEFAULT '100 g'
  );
  CREATE INDEX food_category ON food (category);

  CREATE TABLE meal_plan (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE meal (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES meal_plan (id) ON DELETE CASCADE,
    weekday INTEGER,
    label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE meal_item (
    id INTEGER PRIMARY KEY,
    meal_id INTEGER NOT NULL REFERENCES meal (id) ON DELETE CASCADE,
    food_id INTEGER REFERENCES food (id),
    raw_text TEXT NOT NULL,
    grams REAL NOT NULL,
    match_confidence REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE food_log (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    food_id INTEGER NOT NULL REFERENCES food (id),
    grams REAL NOT NULL,
    meal_item_id INTEGER REFERENCES meal_item (id) ON DELETE SET NULL
  );
  CREATE INDEX food_log_day ON food_log (day);

  CREATE TABLE nutrition_target (
    id INTEGER PRIMARY KEY,
    effective_from TEXT NOT NULL,
    kcal REAL NOT NULL,
    protein_g REAL NOT NULL,
    carbs_g REAL,
    fat_g REAL,
    source TEXT NOT NULL
  );
  `,
];

export async function migrate(db: Db): Promise<number> {
  await db.exec('PRAGMA foreign_keys = ON;');
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.tx(async () => {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  return version;
}
