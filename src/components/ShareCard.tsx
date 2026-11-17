import { useEffect, useMemo, useState } from 'react';
import { weekStreak } from '../analytics';
import { t } from '../i18n';
import { progression } from '../levels';
import { drawWorkoutCard } from '../shareCard';
import { exerciseName, useStore } from '../store';
import { DEFAULT_ACCENT } from '../theme';
import type { Workout } from '../types';
import { computePRs } from '../utils';
import { Icon, Sheet } from './ui';

/** Preview of the workout image, with Share (phone share sheet) and Save. */
export function ShareCardSheet({ workout, open, onClose }: { workout: Workout; open: boolean; onClose: () => void }) {
  const { state, exMap } = useStore();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  useEffect(() => {
    if (!open) return;
    setMsg('');
    const p = progression(state);
    drawWorkoutCard({
      workout,
      name: (id) => exerciseName(exMap, id),
      kind: (id) => exMap.get(id)?.kind ?? 'weight',
      records: new Set(computePRs(state.workouts).keys()),
      unit: state.settings.unit,
      accent: state.settings.accent ?? DEFAULT_ACCENT,
      level: p.level,
      rank: p.rank,
      streak: weekStreak(state.workouts).weeks,
      author: state.profile?.name?.trim() || 'Foundry',
    }).then(setBlob, () => setMsg(t('The image could not be created on this device.')));
    // Drawn once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workout.id]);

  const file = () => new File([blob!], `foundry-${workout.name.replace(/[^\w-]+/g, '-').toLowerCase()}.png`, { type: 'image/png' });
  const share = async () => {
    if (!blob) return;
    const f = file();
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: workout.name });
      } catch {
        /* cancelled */
      }
    } else save();
  };
  const save = () => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file().name;
    a.click();
    setMsg(t('Image saved.'));
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('Share my workout')} tall>
      <div className="share-card">
        {url ? (
          <img src={url} alt={t('Workout card: {name}', { name: workout.name })} />
        ) : (
          <div className="share-card-wait muted">{msg || t('Preparing the image…')}</div>
        )}
        <div className="sheet-actions">
          <button className="btn" onClick={save} disabled={!blob}>
            <Icon name="download" size={18} /> {t('Save')}
          </button>
          <button className="btn btn-primary" onClick={share} disabled={!blob}>
            <Icon name="share" size={18} /> {t('Share')}
          </button>
        </div>
        {msg && url && <p className="ok-line small">{msg}</p>}
        <p className="muted small">{t('Post it in a story or send it to your friends. Only what is on the image is shared.')}</p>
      </div>
    </Sheet>
  );
}
