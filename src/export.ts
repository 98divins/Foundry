/** The user's data and reports as an Excel workbook, for their own analysis. */
import { groupSets, MUSCLE_GROUPS, trainingDays, weeklyDiet, weeklyTraining, weekStarts } from './analytics';
import { goalWeeks } from './goals';
import { t } from './i18n';
import { dayKey, dayTotals, MEAL_LABEL, weightTrend } from './nutrition';
import type { Exercise, State } from './types';
import { epley, exerciseKind, finished, setVolume } from './utils';
import { workbook, type Sheet } from './xlsx';

const iso = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const r1 = (v: number) => Math.round(v * 10) / 10;

export function buildWorkbook(state: State, exMap: Map<string, Exercise>): Blob {
  const name = (id: string) => exMap.get(id)?.label ?? exMap.get(id)?.name ?? id;
  const done = finished(state.workouts);
  const n = state.nutrition;

  const workouts: Sheet = {
    name: t('Workouts'),
    rows: [
      [t('Date'), t('Workout'), t('Duration (min)'), t('Exercises'), t('Sets'), t('Volume (kg)'), t('Notes')],
      ...done.map((w) => {
        let sets = 0;
        let vol = 0;
        for (const we of w.exercises)
          for (const s of we.sets)
            if (s.done) {
              sets++;
              vol += setVolume(s, exerciseKind(we.exerciseId));
            }
        return [
          iso(w.startedAt),
          w.name,
          Math.round(((w.endedAt ?? w.startedAt) - w.startedAt) / 60000),
          w.exercises.length,
          sets,
          Math.round(vol),
          w.note ?? '',
        ];
      }),
    ],
  };

  const sets: Sheet = {
    name: t('Sets'),
    rows: [
      [
        t('Date'),
        t('Workout'),
        t('Exercise'),
        t('Muscle'),
        t('Set'),
        t('Type'),
        t('Weight (kg)'),
        t('Reps'),
        t('Est. 1RM (kg)'),
        t('Duration (s)'),
        t('Distance (km)'),
      ],
      ...done.flatMap((w) =>
        w.exercises.flatMap((we) =>
          we.sets
            .filter((s) => s.done)
            .map((s, i) => [
              iso(w.startedAt),
              w.name,
              name(we.exerciseId),
              exMap.get(we.exerciseId)?.muscle ?? '',
              i + 1,
              s.type,
              s.weight ?? '',
              s.reps ?? '',
              s.weight && s.reps ? r1(epley(s.weight, s.reps)) : '',
              s.duration ?? '',
              s.distance ?? '',
            ]),
        ),
      ),
    ],
  };

  const weights: Sheet = {
    name: t('Weigh-ins'),
    rows: [[t('Date'), t('Weight (kg)'), t('Trend (kg)')], ...weightTrend(n.weights).map((p) => [p.date, p.scale ?? '', r1(p.trend)])],
  };

  const food: Sheet = {
    name: t('Food log'),
    rows: [
      [t('Date'), t('Meal'), t('Food'), t('Brand'), t('Grams'), t('kcal'), t('Protein (g)'), t('Carbs (g)'), t('Fat (g)')],
      ...[...n.log]
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
        .map((e) => [e.date, t(MEAL_LABEL[e.meal]), e.name, e.brand ?? '', e.grams ?? '', Math.round(e.kcal), r1(e.protein), r1(e.carbs), r1(e.fat)]),
    ],
  };

  // Daily totals against the targets in effect.
  const days = [...new Set(n.log.map((e) => e.date))].sort();
  const targetsOn = (day: string) => {
    let tg = null;
    for (const c of n.checkIns) if (c.date <= day) tg = c.targets;
    return tg;
  };
  const daily: Sheet = {
    name: t('Days'),
    rows: [
      [t('Date'), t('kcal'), t('Protein (g)'), t('Carbs (g)'), t('Fat (g)'), t('kcal target'), t('Protein target'), t('Fully logged'), t('Training days')],
      ...days.map((d) => {
        const tot = dayTotals(n.log, d);
        const tg = targetsOn(d);
        const start = new Date(d + 'T00:00').getTime();
        return [
          d,
          Math.round(tot.kcal),
          r1(tot.protein),
          r1(tot.carbs),
          r1(tot.fat),
          tg?.kcal ?? '',
          tg?.protein ?? '',
          n.incompleteDays.includes(d) ? t('No') : t('Yes'),
          trainingDays(done.filter((w) => w.startedAt >= start && w.startedAt < start + 86400000)),
        ];
      }),
    ],
  };

  // Weekly report: training, diet, goals and muscle groups, oldest first.
  const starts = weekStarts(Math.max(4, Math.min(104, done.length ? Math.ceil((Date.now() - done[0].startedAt) / (7 * 86400000)) + 1 : 4)));
  const tr = weeklyTraining(state.workouts, starts);
  const diet = weeklyDiet(n, starts);
  const goals = state.goals ? goalWeeks(state, state.goals, starts[0], Date.now() + 7 * 86400000) : [];
  const weekly: Sheet = {
    name: t('Weekly report'),
    rows: [
      [
        t('Week of'),
        t('Training days'),
        t('Workouts'),
        t('Sets'),
        t('Volume (kg)'),
        t('Minutes'),
        t('Avg kcal'),
        t('Logged days'),
        t('Protein (g/kg)'),
        t('Weight change (kg)'),
        t('Goals met'),
        ...MUSCLE_GROUPS.map((g) => t('Sets: {0}', { 0: g })),
      ],
      ...starts.map((s, i) => {
        const g = goals.find((x) => x.start === s);
        const gs = groupSets(state.workouts, exMap, s, s + 7 * 86400000);
        return [
          dayKey(new Date(s)),
          tr[i].days,
          tr[i].workouts,
          tr[i].sets,
          Math.round(tr[i].volume),
          tr[i].minutes,
          diet[i].avgKcal ?? '',
          diet[i].loggedDays,
          diet[i].proteinPerKg ?? '',
          diet[i].weightChange ?? '',
          g ? (g.met ? t('Yes') : t('No')) : '',
          ...MUSCLE_GROUPS.map((x) => gs[x]),
        ];
      }),
    ],
  };

  const checkIns: Sheet = {
    name: t('Check-ins'),
    rows: [
      [t('Date'), t('Expenditure (kcal)'), t('Trend (kg)'), t('kcal target'), t('Protein target'), t('Carbs target'), t('Fat target')],
      ...n.checkIns.map((c) => [c.date, c.expenditure, c.trendKg ?? '', c.targets.kcal, c.targets.protein, c.targets.carbs, c.targets.fat]),
    ],
  };

  return workbook([weekly, workouts, sets, weights, daily, food, checkIns]);
}

export function downloadWorkbook(state: State, exMap: Map<string, Exercise>) {
  const blob = buildWorkbook(state, exMap);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foundry-${dayKey()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
