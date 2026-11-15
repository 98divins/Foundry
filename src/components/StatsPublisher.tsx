import { useEffect, useRef } from 'react';
import { useCloud } from '../cloud/cloud';
import { publishStats, unpublishStats } from '../cloud/social';
import { buildPublicStats } from '../socialStats';
import { useStore } from '../store';

/**
 * Keeps the training summary friends see up to date: a few seconds after workouts change, and on
 * opening the app. Turning sharing off removes it. Fails silently (offline, social not set up).
 */
export function StatsPublisher() {
  const { state } = useStore();
  const c = useCloud();
  const uid = c.user?.id;
  const sharing = state.settings.shareStats !== false;
  const last = useRef('');
  const workouts = state.workouts;

  useEffect(() => {
    if (!uid || !c.initialSynced) return;
    const id = setTimeout(() => {
      if (!sharing) {
        if (last.current !== 'off') unpublishStats(uid).then(() => (last.current = 'off'), () => {});
        return;
      }
      const stats = buildPublicStats(state);
      const json = JSON.stringify(stats);
      if (json === last.current) return;
      publishStats(uid, stats).then(() => (last.current = json), () => {});
    }, 4000);
    return () => clearTimeout(id);
    // Workouts and the sharing choice are what change the summary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, c.initialSynced, workouts, sharing]);

  return null;
}
