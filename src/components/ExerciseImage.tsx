import { useState } from 'react';
import { photoUrls } from '../exercises';
import type { Exercise } from '../types';

/**
 * Exercise photo with fallbacks: CDN, then GitHub, then the first letter of the name.
 * crossOrigin keeps responses readable so the service worker can cache them for offline use.
 */
export function ExerciseImage({
  ex,
  label,
  size = 'thumb',
  frame = 0,
}: {
  ex: Exercise | undefined;
  label: string;
  size?: 'thumb' | 'large';
  frame?: 0 | 1;
}) {
  const urls = ex?.image ? photoUrls(ex.image, frame) : [];
  const [attempt, setAttempt] = useState(0);
  const cls = size === 'thumb' ? 'ex-thumb' : 'ex-photo';
  if (attempt >= urls.length) {
    return (
      <span className={cls + ' ex-thumb-letter'} aria-hidden="true">
        {label[0]?.toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className={cls}
      src={urls[attempt]}
      alt={size === 'large' ? `${label}, ${frame ? 'end' : 'start'} position` : ''}
      loading="lazy"
      decoding="async"
      crossOrigin="anonymous"
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}
