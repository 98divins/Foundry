import { useEffect, useState } from 'react';
import { useCloud } from '../cloud/cloud';
import { incomingCount, watchFriendships } from '../cloud/social';

/** Number of pending friend requests, kept up to date (live when possible, every minute otherwise). */
export function useIncomingRequests(): number {
  const c = useCloud();
  const uid = c.user?.id;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!uid) return;
    const refresh = () => incomingCount(uid).then(setN, () => {});
    refresh();
    let stop = () => {};
    let alive = true;
    watchFriendships(uid, refresh).then((s) => (alive ? (stop = s) : s()));
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), 60000);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      stop();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid]);
  return n;
}
