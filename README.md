# Foundry

A personal workout log that runs in the browser and installs on your phone (PWA).
Log sets as you train, follow a rest timer, and track records and progress per exercise.
All data stays on your device.

## Features

- **Live workouts**: add exercises, log weight × reps per set, tick sets as you go. Each set shows what you did last time; tick an empty set to reuse those numbers.
- **Set types**: normal, warm-up (left out of stats), drop set, failure.
- **Rest timer**: starts automatically when you tick a set, ±15 s, skip, beep and vibration when it ends. The screen stays awake during a workout.
- **Routines**: reusable templates (Push / Pull / Legs included as a starting point). Start one in a single tap, or save any finished workout as a routine.
- **History**: every workout with duration, volume and records. Edit a past workout or log one after the fact.
- **Records**: heaviest set, best estimated 1RM (Epley), best set volume, most reps for bodyweight moves. A record is flagged when it beats all earlier workouts.
- **Progress**: per-exercise charts (est. 1RM, heaviest, volume, reps), workouts per week, working sets per muscle over the last 30 days.
- **Exercise library**: ~75 common exercises plus your own custom ones.
- **kg or lb**: weights are stored in kg and converted for display.
- **Your data**: JSON backup and restore, CSV export, and **CSV import from a Hevy export** (Hevy → Settings → Export & Import Data → Export workouts). Unknown exercise names become custom exercises; workouts already present are skipped.

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
| `src/exercises.ts` | Built-in exercise library |
| `src/components/WorkoutEditor.tsx` | Set table used by live workouts, routines and edits |
| `src/screens/` | One file per screen |
| `public/sw.js` | Offline cache |
