# Plasma

An offline-first training and nutrition app built with Expo (React Native). It plans your week, logs your sets, tracks body metrics, optimizes meals for protein and keeps score of what you owe. Plasma never blocks or second-guesses a plan you choose.

## Run it

```bash
npm install
npm start          # Expo dev server; open in Expo Go or a dev build
npm test           # domain + database tests (node:sqlite)
npm run typecheck
```

`npm run web` starts a browser preview for development. It needs the COOP/COEP headers set in `metro.config.js` so expo-sqlite can run on wasm. Reminders and sharing only work on a phone.

Builds use EAS: `eas build -p android --profile preview` gives an installable APK.

## What it does

- **Routines**: pick a split (full body, upper/lower, push/pull/legs, bro split, custom), training days, and length and intensity per day. Exercises are auto-picked from your equipment, or you choose them; any exercise can be swapped for a substitute.
- **Exercise library**: about 870 exercises with demo images and instructions, available offline. Demos come through a `MediaProvider`, so the source can be swapped.
- **Workout logging**: sets, reps and weight, with a rest timer and history.
- **Body metrics**:
  - BMI, flagged as a crude measure.
  - US Navy body fat %.
  - Mifflin-St Jeor BMR and TDEE.
  - A 7-day moving average of weight.
  - Every result shows its formula.
- **Nutrition**:
  - Paste or upload a menu as text or CSV, in any meal pattern (OMAD included).
  - Items are matched against USDA FoodData Central; you can correct any match.
  - A protein-maximizing optimizer works within your calorie budget.
- **Challenges** (volume, reps, calories, streak): counted automatically from your log, with pace and a projected finish date.
- **Debt**:
  - Skipped planned work becomes debt, spread over the next days that train the same muscle.
  - The daily cap defaults to 25%; it can be custom or turned off.
  - Substitutes repay at their equivalence factor.
- **Max plan**: the most weekly sets that fit your days and session length. Recovery limits can be on or off, and the plan explains why it looks the way it does.
- **Settings**: metric or imperial units, light/dark/system theme, a daily reminder, and JSON export.

## Design notes

- All health data stays in SQLite on the device. Nothing is sent anywhere.
- Logic lives in `src/domain` as pure functions with tests; `src/db` holds migrations and repositories; `src/app` holds the screens (expo-router).
- `npm run build:data` regenerates `src/data/*.json` from the upstream datasets.

## Not built yet

Sync, accounts and leaderboards. The settings screen says so.

## Data sources

- Exercises: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), Unlicense.
- Foods: [USDA FoodData Central](https://fdc.nal.usda.gov), public domain.
- Typeface: Plus Jakarta Sans, SIL Open Font License 1.1.
