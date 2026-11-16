/**
 * Interval routines (HIIT, Tabata, EMOM-style circuits): prepare, then cycles of rounds of
 * work / rest, with a longer rest between cycles, then a cool-down. All durations in seconds.
 */
import { tk } from './i18n';

export interface IntervalPlan {
  prepare: number;
  work: number;
  rest: number;
  rounds: number;
  cycles: number;
  cycleRest: number;
  cooldown: number;
  /** Optional names for the work rounds, used in turn (e.g. Burpees, Squats, Mountain climbers). */
  moves?: string[];
}

export const DEFAULT_PLAN: IntervalPlan = { prepare: 10, work: 40, rest: 20, rounds: 8, cycles: 1, cycleRest: 60, cooldown: 0, moves: [] };

/** Ready-made settings to start from. */
export const PRESETS: { id: string; name: string; plan: IntervalPlan }[] = [
  { id: 'tabata', name: tk('Tabata'), plan: { prepare: 10, work: 20, rest: 10, rounds: 8, cycles: 1, cycleRest: 60, cooldown: 0 } },
  { id: 'hiit', name: tk('HIIT 40/20'), plan: { prepare: 10, work: 40, rest: 20, rounds: 8, cycles: 2, cycleRest: 60, cooldown: 60 } },
  { id: 'emom', name: tk('Every minute (EMOM 10)'), plan: { prepare: 10, work: 60, rest: 0, rounds: 10, cycles: 1, cycleRest: 0, cooldown: 0 } },
  { id: 'run', name: tk('Run / walk 1:1'), plan: { prepare: 10, work: 60, rest: 60, rounds: 10, cycles: 1, cycleRest: 0, cooldown: 120 } },
];

export type PhaseKind = 'prepare' | 'work' | 'rest' | 'cycleRest' | 'cooldown';

export interface Phase {
  kind: PhaseKind;
  sec: number;
  round: number;
  cycle: number;
  move?: string;
}

export function phasesOf(p: IntervalPlan): Phase[] {
  const out: Phase[] = [];
  const moves = (p.moves ?? []).filter((m) => m.trim());
  if (p.prepare > 0) out.push({ kind: 'prepare', sec: p.prepare, round: 1, cycle: 1 });
  let n = 0;
  for (let c = 1; c <= Math.max(1, p.cycles); c++) {
    for (let r = 1; r <= Math.max(1, p.rounds); r++) {
      out.push({ kind: 'work', sec: Math.max(1, p.work), round: r, cycle: c, move: moves.length ? moves[n % moves.length] : undefined });
      n++;
      const lastRound = r === Math.max(1, p.rounds);
      if (!lastRound && p.rest > 0) out.push({ kind: 'rest', sec: p.rest, round: r, cycle: c });
    }
    if (c < Math.max(1, p.cycles) && p.cycleRest > 0) out.push({ kind: 'cycleRest', sec: p.cycleRest, round: p.rounds, cycle: c });
  }
  if (p.cooldown > 0) out.push({ kind: 'cooldown', sec: p.cooldown, round: p.rounds, cycle: p.cycles });
  return out;
}

export const totalSeconds = (p: IntervalPlan) => phasesOf(p).reduce((s, x) => s + x.sec, 0);

export const PHASE_LABEL: Record<PhaseKind, string> = {
  prepare: tk('Get ready'),
  work: tk('Work'),
  rest: tk('Rest'),
  cycleRest: tk('Rest between cycles'),
  cooldown: tk('Cool-down'),
};

/** "1:30", "45 s" */
export const fmtSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`);

/** One line for lists: "8 × 40 s / 20 s · 2 cycles · 12 min". */
export function planSummary(p: IntervalPlan, t: (k: string, v?: Record<string, string | number>) => string): string {
  const parts = [`${p.rounds} × ${fmtSec(p.work)}${p.rest ? ' / ' + fmtSec(p.rest) : ''}`];
  if (p.cycles > 1) parts.push(t('{n} cycles', { n: p.cycles }));
  parts.push(t('{n} min', { n: Math.round(totalSeconds(p) / 60) }));
  return parts.join(' · ');
}
