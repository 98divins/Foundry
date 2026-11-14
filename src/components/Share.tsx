import { useState } from 'react';
import { encodeRoutines, shareUrl } from '../routines';
import type { Routine, RoutineFolder } from '../types';

/** Copies a share link, falling back to showing it for manual copy. */
export function useShareLink() {
  const [shared, setShared] = useState<{ url: string; copied: boolean } | null>(null);
  const share = async (folder: RoutineFolder | undefined, routines: Routine[]) => {
    const url = shareUrl(await encodeRoutines(folder, routines));
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      /* shown below for manual copy */
    }
    setShared({ url, copied });
  };
  return { shared, share, clear: () => setShared(null) };
}

export function ShareResult({ shared, onClose }: { shared: { url: string; copied: boolean } | null; onClose: () => void }) {
  if (!shared) return null;
  return (
    <div className="share-box" role="status">
      <p>
        {shared.copied
          ? 'Link copied. Anyone who opens it can add these routines to their Foundry.'
          : 'Copy this link to share these routines:'}
      </p>
      {!shared.copied && (
        <textarea id="share-url" readOnly rows={3} value={shared.url} onFocus={(e) => e.currentTarget.select()} />
      )}
      <button className="btn btn-small" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

