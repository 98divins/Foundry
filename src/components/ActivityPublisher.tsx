import { useEffect, useMemo, useRef } from 'react';
import { useCloud } from '../cloud/cloud';
import { publishActivity, unpublishActivity } from '../cloud/social';
import { countsForXp, progression } from '../levels';
import { exerciseName, useStore } from '../store';
import { computePRs, finished, workoutSetCount, workoutVolume } from '../utils';

const DAY = 86400000;
const keyFor = (uid: string) => 'foundry:feed:' + uid;
interface Seen {
  workouts: string[];
  level: number;
  badges: string[];
}

/**
 * Posts finished workouts (last 7 days), new levels and new badges to the friends' feed, and removes
 * a workout's post when the workout is deleted. Off when the user does not share stats. Fails silently.
 */
export function ActivityPublisher() {
  const { state, exMap } = useStore();
  const c = useCloud();
  const uid = c.user?.id;
  const sharing = state.settings.shareStats !== false;
  const p = useMemo(() => progression(state), [state]);
  const busy = useRef(false);

  useEffect(() => {
    if (!uid || !c.initialSynced || !sharing) return;
    const id = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        let seen: Seen | null = null;
        try {
          seen = JSON.parse(localStorage.getItem(keyFor(uid)) ?? 'null');
        } catch {
          /* ignore */
        }
        const first = !seen;
        const s: Seen = seen ?? { workouts: [], level: p.level, badges: p.badges };
        const now = Date.now();
        // On the very first run, only the last 2 days are posted, so friends are not flooded.
        const since = now - (first ? 2 : 7) * DAY;
        const done = finished(state.workouts);
        const recent = done.filter((w) => w.startedAt >= since && countsForXp(w));
        const prs = computePRs(state.workouts);
        for (const w of recent) {
          if (s.workouts.includes(w.id)) continue;
          let records = 0;
          for (const we of w.exercises) for (const x of we.sets) if (prs.has(x.id)) records++;
          await publishActivity(
            uid,
            'w-' + w.id,
            {
              kind: 'workout',
              name: w.name,
              at: w.startedAt,
              minutes: Math.round((w.endedAt! - w.startedAt - (w.pausedMs ?? 0)) / 60000),
              sets: workoutSetCount(w),
              volume: Math.round(workoutVolume(w)),
              records,
              exercises: w.exercises.slice(0, 5).map((we) => exerciseName(exMap, we.exerciseId)),
            },
            w.endedAt ?? w.startedAt,
          );
          s.workouts.push(w.id);
        }
        // A posted workout that was deleted: take its post down.
        const ids = new Set(state.workouts.map((w) => w.id));
        for (const wid of [...s.workouts]) {
          if (ids.has(wid)) continue;
          await unpublishActivity(uid, 'w-' + wid);
          s.workouts = s.workouts.filter((x) => x !== wid);
        }
        if (!first) {
          if (p.level > s.level) await publishActivity(uid, 'level-' + p.level, { kind: 'level', level: p.level });
          for (const b of p.badges.filter((x) => !s.badges.includes(x))) await publishActivity(uid, 'badge-' + b, { kind: 'badge', badge: b });
        }
        // A level or badge that no longer holds (a workout was deleted): take its post down.
        for (let l = p.level + 1; l <= s.level; l++) await unpublishActivity(uid, 'level-' + l);
        for (const b of s.badges.filter((x) => !p.badges.includes(x))) await unpublishActivity(uid, 'badge-' + b);
        s.level = p.level;
        s.badges = p.badges;
        // Keep the list short: only what could still be deleted and re-posted.
        s.workouts = s.workouts.filter((wid) => (state.workouts.find((w) => w.id === wid)?.startedAt ?? now) >= now - 30 * DAY);
        localStorage.setItem(keyFor(uid), JSON.stringify(s));
      } catch {
        /* offline or feed not set up on the server: try again next change */
      } finally {
        busy.current = false;
      }
    }, 5000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, c.initialSynced, sharing, state.workouts, p.level, p.badges.join()]);

  return null;
}
