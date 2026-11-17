# Foundry

A strength training and nutrition app for people who lift: log workouts, follow your diet, and see how
the two line up. It runs in the browser and installs on a phone as a PWA (French and English).

Live: <https://98divins.github.io/Foundry/> · Proprietary, all rights reserved (see `LICENSE`).

## What it does

**Training**
- Live workouts with a rest timer, set types (warm-up, drop, failure), supersets, notes and a
  "Previous" column; last time's best set as a hint, generated warm-up sets, a plate calculator,
  notes pinned to an exercise and an optional RPE per set.
- Saved workouts and folders, ready-made programs, interval timers (HIIT, Tabata, run/walk).
- 450 exercises (English and French names, photos from Free Exercise DB) plus custom ones with
  your own photo.
- History, records, per-exercise charts, strength index, muscle balance, training load
  (weekly sets, tonnage, time and the 7-day / 28-day ratio).
- Import from Hevy or Strong (CSV); export to CSV, Excel and a JSON backup.

**Nutrition**
- Six meal slots, French food list, Open Food Facts search and barcode scan, custom foods, saved
  meals (with photos, shareable with the community), meal planning on other days.
- Search ranks the foods you usually eat at this meal first; one tap adds your usual amount.
- Weight trend, adaptive expenditure and weekly targets, with safeguards (no loss target under
  BMI 18.5, at most 1 % of body weight per week).

**Diet × strength**
- A weekly card (calorie gap, protein per kg, strength index change), phases (cut, maintenance,
  bulk) compared with each other, and tips fired by explicit rules with minimum data, worded as
  observations.

**Friends**
- Usernames, friend requests, an activity feed with Respect and comments, a leaderboard and a
  face-to-face comparison over a period or any dates, public profile pages, reports.

Features still in test (levels and badges, challenges, gear, recaps, RPE) are off by default and
can be turned on in Settings → Features in test (`src/features.ts`).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run e2e          # five user journeys + accessibility audit (Playwright, see below)
npm run test:rls     # access rules of the Supabase tables, on a local PostgreSQL
npm run lint         # ESLint
npm run format       # Prettier (format:check in CI)
npm run build        # type check + static site in dist/
node scripts/perf.cjs   # start-up time with 5 years of fictional data (fails above 1 s)
```

`npm run e2e` builds the app against a fake Supabase (`e2e/fake.ts` answers every request inside
the browser), then runs: first launch, logging a workout, logging a food, building and starting a
saved workout, offline use and a second device, and an axe audit (WCAG 2.1 AA) of nine screens in
light and dark themes. Chromium comes from `npx playwright install chromium`.

Every push to `main` runs the access-rule tests, the e2e journeys, lint, format check, unit tests
and the build; the site is deployed to GitHub Pages only when all of them pass.

## How data is stored and synced

- **On the device**: IndexedDB (`src/db.ts`), one record per month and kind of item, written
  300 ms after a change and when the app is hidden. The app works fully offline.
- **Account (Supabase)**: required to use the app. Sync v2 keeps one row per item in
  `user_items`, timed by the server; each device sends what changed and asks for what changed since
  its last visit (`docs/SYNC_V2.md`). Older accounts still use one JSON copy (`user_state`) until
  they move to v2.
- **Photos** (meals, custom foods and exercises) go to a private storage bucket, shrunk on the
  phone first; exercise and food photos are visible to their owner only, meal photos to friends.
- Health data (weight, food) needs a separate consent; terms, privacy policy and the processing
  register are in `src/legal.ts` and `docs/legal/`.

Setting up Supabase (SQL files to run, in order, and dashboard settings): `supabase/README.md`.
The project URL and publishable key live in `src/cloud/config.ts` (public by design; the access
rules protect the data).

## Code map

| Path | What it holds |
| --- | --- |
| `src/types.ts`, `src/nutrition.ts` | Data model and nutrition engine (trend, expenditure, targets) |
| `src/store.tsx`, `src/db.ts` | App state, IndexedDB storage |
| `src/cloud/` | Supabase client, sync v1 and v2, social features, photos |
| `src/analytics.ts`, `src/trainingLoad.ts`, `src/dietStrength.ts` | Statistics, training load, diet × strength |
| `src/progression.ts`, `src/plates.ts` | Best set, warm-ups, plate calculator |
| `src/foods.ts`, `src/foodsFr*.ts`, `src/csv.ts` | Food search and data, CSV import/export |
| `src/features.ts`, `src/pro.ts` | Feature switches, free and Pro plans |
| `src/i18n.ts`, `src/i18n.fr.ts` | Translations (English keys, French dictionary) |
| `src/screens/`, `src/components/` | Screens and shared components |
| `supabase/` | SQL (tables, access rules, admin views) and the access-rule tests |
| `e2e/` | End-to-end journeys and the accessibility audit |
| `docs/` | Plans, sync design, legal documents |

Food data: USDA FoodData Central via TempoLife (CC-BY-4.0) and Open Food Facts (ODbL). Exercise
photos: Free Exercise DB (public domain).
