# Foundry

A personal workout log that runs in the browser and installs on your phone (PWA).
Log sets as you train, follow a rest timer, and track records and progress per exercise.
All data stays on your device.

## Features

- **Live workouts**: add exercises, log weight × reps per set, tick sets as you go. Each set shows what you did last time; tick an empty set to reuse those numbers.
- **Set types**: normal, warm-up (left out of stats), drop set, failure.
- **Rest timer**: starts automatically when you tick a set, ±15 s, skip, beep and vibration when it ends. The screen stays awake during a workout.
- **Explore programs**: Full Body (3 days), Upper / Lower (4 days) and Push / Pull / Legs, copied into your routines in one tap.
- **During a workout**: replace an exercise for this session only (sets already done stay on the original), change a set's type or remove it from its number, and see when a rest ended while you were away.
- **Routines and folders**: reusable templates with target rep ranges (e.g. 8-12), supersets and notes, grouped in folders (e.g. “Upper/Lower x2”). Each routine has a summary: exercises, sets, estimated time and sets per muscle.
- **Share links**: copy a link to a routine or a whole folder; opening it (or pasting it in the app) adds the routines on that device (Push / Pull / Legs included as a starting point). Start one in a single tap, or save any finished workout as a routine.
- **History**: every workout with duration, volume and records. Edit a past workout or log one after the fact.
- **Records**: heaviest set, best estimated 1RM (Epley), best set volume, most reps for bodyweight moves. A record is flagged when it beats all earlier workouts.
- **Progress**: per-exercise charts (est. 1RM, heaviest, volume, reps), workouts per week, working sets per muscle over the last 30 days.
- **Exercise library**: 450 exercises with English and French names (choose in Progress → Settings), searchable without accents and filterable by muscle and equipment, plus your own custom ones. 376 have start and end photos from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (public domain), loaded from a CDN and cached for offline use.
- **Tracking types**: weight × reps, bodyweight reps with optional added weight, assisted reps (the assistance never counts as volume), timed holds (plank, dead hang…) and cardio (distance and time).
- **kg or lb**: weights are stored in kg and converted for display.
- **Your data**: JSON backup and restore, CSV export, and **CSV import from a Hevy export** (Hevy → Settings → Export & Import Data → Export workouts). Unknown exercise names become custom exercises; workouts already present are skipped.

## Progress

- **Strength**: estimated-1RM trend for your most trained lifts (with change over the last 8 weeks) and a strength index: each lift's best of the week as a % of your first session, averaged.
- **Training per week**: sets, workouts or volume over 12 weeks.
- **Sets per muscle**: this week or the 4-week average, against a 10–20 sets guideline.
- **Records** of the last 30 days.
- **Diet × training**: a weekly table of calories, protein per kg, weight change, sets and strength index, and plain-language observations once there are about 5 weeks of data on both sides.

## Nutrition

- **Six meal slots**: breakfast, snacks after breakfast, lunch, snacks after lunch, dinner, snacks after dinner.
- **Favourite foods** (star) listed first, and **saved meals** logged in one tap with a number of servings. Create them from scratch or with “Save as meal” on a slot. Logging copies the meal, so editing it later changes future logs only, unless you tick “also update the days where it is already logged”.
- **Food log** by meal: search 150 common foods with French names (built in, works offline), 5 900 more basic foods in English, and branded products from Open Food Facts by name or **barcode** (camera or typed). Quick add for calories and macros, and your own foods from the label.
- **Weight trend**: daily weigh-ins smoothed into a trend line, so water swings do not hide progress.
- **Adaptive expenditure**: starts from Mifflin-St Jeor × activity, then learns from your data. Each day it compares the last 3 weeks of intake with the slope of your weight and moves 10 % toward what that implies (7 700 kcal per kg). Days marked as not fully logged are left out.
- **Weekly check-in**: calories = expenditure + your chosen rate of weight change; protein per kg of trend weight, fat as a share of calories, carbs fill the rest. Never below 1 200 / 1 500 kcal.

Food data: USDA FoodData Central (public domain) via the [TempoLife food dataset](https://tempolife.app) (CC-BY-4.0), and [Open Food Facts](https://openfoodfacts.org) (ODbL).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for records, stats and CSV import/export
npm run build      # static site in dist/
```

## Put it on your phone

The build is a static site, so any static host works. With GitHub Pages:

1. In the repository settings, open **Pages** and set **Source** to **GitHub Actions**.
2. Push to `main` (or run the *Deploy to GitHub Pages* workflow manually).
3. Open the published URL on your phone and use **Add to Home Screen**.

Data is kept in the browser's local storage on that device. Export a backup from **Profile** before clearing browser data or switching phones.

## Code map

| Path | What it holds |
| --- | --- |
| `src/types.ts` | Data model (workouts, sets, routines, settings) |
| `src/store.tsx` | App state, persistence, starter routines |
| `src/utils.ts` | Volume, 1RM, records, sessions, formatting |
| `src/csv.ts` | CSV parser, Hevy-format import, CSV export |
| `src/exerciseData.ts` | The 450 exercises: names, muscle, equipment, tracking type, photo |
| `src/exercises.ts` | Library helpers: labels in both languages, photo URLs, search |
| `src/components/WorkoutEditor.tsx` | Set table used by live workouts, routines and edits |
| `src/screens/` | One file per screen |
| `public/sw.js` | Offline cache |
