// Fictional data for performance checks (docs/SYNC_V2.md, section 4): N years of a very regular
// lifter who logs every meal. Usage: node scripts/fake-years.cjs 5 > /tmp/state.json
const years = Number(process.argv[2] || 5);
const DAY = 86400000;
const start = Date.UTC(2026 - years, 0, 1);
let n = 0;
const id = (p) => p + (++n).toString(36);
const lifts = ['bench_bb', 'squat_bb', 'deadlift_bb', 'ohp_bb', 'row_bb', 'pullup', 'curl_db', 'lat_raise_db'];
const workouts = [];
const log = [];
const weights = [];
for (let d = 0; d < years * 365; d++) {
  const t = start + d * DAY;
  const date = new Date(t).toISOString().slice(0, 10);
  if (d % 7 < 5) {
    const startedAt = t + 18 * 3600000;
    workouts.push({
      id: id('w'),
      name: 'Séance ' + (d % 5),
      startedAt,
      endedAt: startedAt + 70 * 60000,
      exercises: lifts.slice(d % 3, (d % 3) + 5).map((ex) => ({
        id: id('e'),
        exerciseId: ex,
        restSec: 120,
        sets: Array.from({ length: 4 }, () => ({ id: id('s'), type: 'normal', weight: 40 + (d % 60), reps: 8, done: true })),
      })),
    });
  }
  for (let m = 0; m < 14; m++)
    log.push({
      id: id('l'),
      date,
      meal: ['breakfast', 'lunch', 'dinner', 'snacks'][m % 4],
      foodId: 'f' + (m % 30),
      name: 'Aliment ' + (m % 30),
      grams: 100,
      kcal: 150,
      protein: 10,
      carbs: 15,
      fat: 5,
      createdAt: t + m * 1000,
    });
  weights.push({ date, kg: 80 + Math.sin(d / 30) });
}
const state = {
  version: 1,
  workouts,
  routines: [],
  folders: [],
  customExercises: [],
  active: null,
  rest: null,
  settings: {
    unit: 'kg',
    defaultRest: 90,
    sound: true,
    exerciseLang: 'fr',
    consent: { at: 1, version: '2026-11-v3' },
    healthConsent: { at: 1, version: '2026-11-v1' },
  },
  nutrition: {
    profile: { sex: 'male', birthYear: 1990, heightCm: 180, activity: 'moderate' },
    rateKgPerWeek: 0,
    proteinPerKg: 2,
    fatShare: 0.28,
    checkInDay: 1,
    foods: [],
    log,
    weights,
    incompleteDays: [],
    checkIns: [],
    favorites: [],
    savedMeals: [],
  },
};
process.stdout.write(JSON.stringify(state));
