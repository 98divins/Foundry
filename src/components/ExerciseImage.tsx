import { useState } from 'react';
import { photoUrls } from '../exercises';
import type { Exercise } from '../types';
import { t } from '../i18n';
import { PhotoView } from './Photo';

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
  // A custom exercise with the person's own photo.
  if (ex?.photo && size === 'thumb') return <PhotoView path={ex.photo.path} at={ex.photo.at} alt="" className={cls} />;
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
      alt={size === 'large' ? frame ? t('{name}, end position', { name: label }) : t('{name}, start position', { name: label }) : ''}
      loading="lazy"
      decoding="async"
      crossOrigin="anonymous"
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}
