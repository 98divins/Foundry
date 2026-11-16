/**
 * The image shared at the end of a workout (1080 × 1350, fits a post and a story). Drawn on a canvas
 * in Foundry's colours, so it needs no server and works offline.
 */
import { t, tp } from './i18n';
import type { Rank } from './levels';
import type { ExerciseKind, Unit, Workout } from './types';
import { epley, fmtDate, fmtDuration, fmtNum, fmtSet, workoutSetCount, workoutVolume } from './utils';

export interface CardInput {
  workout: Workout;
  name: (exerciseId: string) => string;
  kind: (exerciseId: string) => ExerciseKind;
  records: Set<string>;
  unit: Unit;
  accent: string;
  level: number;
  rank: Rank;
  streak: number;
  author: string;
}

const W = 1080;
const H = 1350;
const DISPLAY = "'Archivo Variable', 'Archivo', 'Helvetica Neue', Arial, sans-serif";
const BODY = "'IBM Plex Sans', system-ui, sans-serif";

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

function logo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, accent: string) {
  // Same shapes as the app icon (viewBox 96 104 330 260).
  ctx.save();
  ctx.translate(x, y);
  const k = size / 330;
  ctx.scale(k, k);
  ctx.translate(-96, -104);
  ctx.fillStyle = accent;
  ctx.fill(new Path2D('M148 178h216l46 178H102z'));
  ctx.fillStyle = '#0d1015';
  ctx.fill(new Path2D('M206 214h112v36h-74v20h60v34h-60v52h-38z'));
  ctx.fillStyle = '#e08a4c';
  ctx.fill(new Path2D('M376 116l14 26 26 14-26 14-14 26-14-26-26-14 26-14z'));
  ctx.restore();
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** "8,1 t" / "17.9k lb": short enough for a tile. */
function compactVolume(kg: number, unit: Unit): string {
  if (unit === 'lb') {
    const lb = kg * 2.20462;
    return lb >= 1000 ? fmtNum(Math.round(lb / 100) / 10) + 'k lb' : fmtNum(Math.round(lb)) + ' lb';
  }
  return kg >= 1000 ? fmtNum(Math.round(kg / 100) / 10) + ' t' : fmtNum(Math.round(kg)) + ' kg';
}

export async function drawWorkoutCard(input: CardInput): Promise<Blob> {
  const { workout: w, unit, accent } = input;
  await document.fonts?.ready;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // Background: near-black with a glow of the accent colour.
  ctx.fillStyle = '#0d1015';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.85, 0, 50, W * 0.85, 0, 900);
  g.addColorStop(0, accent + '66');
  g.addColorStop(1, accent + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const P = 80;
  logo(ctx, P, 70, 74, accent);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `800 40px ${DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('FOUNDRY', P + 92, 101);

  // Title and date
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 84px ${DISPLAY}`;
  ctx.fillText(fit(ctx, w.name, W - 2 * P), P, 270);
  ctx.fillStyle = '#8e98a6';
  ctx.font = `500 34px ${BODY}`;
  ctx.fillText(fit(ctx, `${fmtDate(w.startedAt)} · ${input.author}`, W - 2 * P), P, 325);

  // Four numbers
  const records = w.exercises.flatMap((e) => e.sets).filter((s) => input.records.has(s.id)).length;
  const stats: [string, string][] = [
    [t('Duration'), fmtDuration((w.endedAt ?? w.startedAt) - w.startedAt - (w.pausedMs ?? 0))],
    [t('Volume'), compactVolume(workoutVolume(w), unit)],
    [t('Sets'), String(workoutSetCount(w))],
    [t('Records'), String(records)],
  ];
  const tw = (W - 2 * P - 3 * 20) / 4;
  stats.forEach(([label, value], i) => {
    const x = P + i * (tw + 20);
    round(ctx, x, 380, tw, 150, 22);
    ctx.fillStyle = i === 3 && records ? 'rgba(224,138,76,0.16)' : '#151a21';
    ctx.fill();
    ctx.strokeStyle = i === 3 && records ? '#e08a4c' : '#2a313c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = i === 3 && records ? '#e08a4c' : '#eef1f5';
    ctx.font = `800 46px ${DISPLAY}`;
    ctx.fillText(fit(ctx, value, tw - 40), x + 24, 460);
    ctx.fillStyle = '#8e98a6';
    ctx.font = `500 26px ${BODY}`;
    ctx.fillText(fit(ctx, label, tw - 40), x + 24, 503);
  });

  // Exercises with their best set
  let y = 610;
  const list = w.exercises.filter((e) => e.sets.some((s) => s.done));
  for (const we of list.slice(0, 6)) {
    const kind = input.kind(we.exerciseId);
    const done = we.sets.filter((s) => s.done && s.type !== 'warmup');
    const sets = done.length ? done : we.sets.filter((s) => s.done);
    const best =
      kind === 'weight'
        ? sets.reduce((a, s) => (epley(s.weight ?? 0, s.reps ?? 0) > epley(a.weight ?? 0, a.reps ?? 0) ? s : a), sets[0])
        : sets[sets.length - 1];
    const pr = we.sets.some((s) => input.records.has(s.id));
    ctx.fillStyle = '#eef1f5';
    ctx.font = `600 36px ${BODY}`;
    ctx.fillText(fit(ctx, input.name(we.exerciseId), 600), P, y);
    ctx.fillStyle = '#8e98a6';
    ctx.font = `500 28px ${BODY}`;
    ctx.fillText(tp(sets.length, '{n} set', '{n} sets'), P, y + 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = pr ? '#e08a4c' : '#eef1f5';
    ctx.font = `700 36px ${DISPLAY}`;
    ctx.fillText((pr ? '★ ' : '') + (best ? fmtSet(best, kind, unit) : ''), W - P, y + 16);
    ctx.textAlign = 'left';
    y += 100;
  }
  if (list.length > 6) {
    ctx.fillStyle = '#8e98a6';
    ctx.font = `500 28px ${BODY}`;
    ctx.fillText(t('+ {n} more exercises', { n: list.length - 6 }), P, y - 20);
  }

  // Footer: level and streak
  const fy = H - 110;
  ctx.strokeStyle = '#2a313c';
  ctx.beginPath();
  ctx.moveTo(P, fy - 60);
  ctx.lineTo(W - P, fy - 60);
  ctx.stroke();
  const hex = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
  };
  hex(P + 36, fy, 38);
  ctx.fillStyle = input.rank.color;
  ctx.fill();
  ctx.fillStyle = '#0d1015';
  ctx.font = `800 32px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(input.level), P + 36, fy + 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = input.rank.color;
  ctx.font = `700 32px ${BODY}`;
  ctx.fillText(t('Level {n}', { n: input.level }) + ' · ' + t(input.rank.name), P + 96, fy);
  if (input.streak > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e08a4c';
    ctx.fillText(tp(input.streak, '{n} week in a row', '{n} weeks in a row'), W - P, fy);
    ctx.textAlign = 'left';
  }

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('canvas'))), 'image/png'));
}
