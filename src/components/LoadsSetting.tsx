import { defaultLoads } from '../exercises';
import { t } from '../i18n';
import { useStore } from '../store';
import { Segmented } from './ui';

/**
 * Whether a logged set counts once or twice in the volume: twice with two dumbbells (the weight of one
 * is logged) or for a move done on each side in turn (one side is logged). For loaded exercises.
 */
export function LoadsSetting({ exerciseId }: { exerciseId: string }) {
  const { state, update, exMap } = useStore();
  const ex = exMap.get(exerciseId);
  if (!ex || (ex.kind !== 'weight' && ex.kind !== 'bodyweight')) return null;
  const base = defaultLoads(ex);
  const value = state.settings.loads?.[exerciseId] ?? base;
  return (
    <div className="loads-setting">
      <span className="small">{t('Each set counts in the volume')}</span>
      <Segmented<'1' | '2'>
        label={t('Each set counts in the volume')}
        value={String(value) as '1' | '2'}
        onChange={(v) =>
          update((s) => {
            const loads = { ...s.settings.loads };
            const n = Number(v) as 1 | 2;
            if (n === base) delete loads[exerciseId];
            else loads[exerciseId] = n;
            return { ...s, settings: { ...s.settings, loads } };
          })
        }
        options={[
          { value: '1', label: t('Once') },
          { value: '2', label: t('Twice') },
        ]}
      />
      <p className="muted small">
        {t('Twice for two dumbbells (log the weight of one) or a move done on each side (log one side). Records and 1RM stay on what you log.')}
      </p>
    </div>
  );
}

/** The same choice when creating a custom exercise. */
export function LoadsChoice({ value, onChange }: { value: 1 | 2; onChange: (v: 1 | 2) => void }) {
  return (
    <div className="loads-setting">
      <span className="small">{t('Each set counts in the volume')}</span>
      <Segmented<'1' | '2'>
        label={t('Each set counts in the volume')}
        value={String(value) as '1' | '2'}
        onChange={(v) => onChange(Number(v) as 1 | 2)}
        options={[
          { value: '1', label: t('Once') },
          { value: '2', label: t('Twice') },
        ]}
      />
      <p className="muted small">
        {t('Twice for two dumbbells (log the weight of one) or a move done on each side (log one side). Records and 1RM stay on what you log.')}
      </p>
    </div>
  );
}
