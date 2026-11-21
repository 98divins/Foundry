import { defaultLoads } from '../exercises';
import { t } from '../i18n';
import { useStore } from '../store';
import { Segmented } from './ui';

/** Shown for dumbbell and kettlebell exercises: whether one or two are lifted at once. */
export function LoadsSetting({ exerciseId }: { exerciseId: string }) {
  const { state, update, exMap } = useStore();
  const ex = exMap.get(exerciseId);
  if (!ex || ex.kind !== 'weight' || (ex.equipment !== 'dumbbell' && ex.equipment !== 'kettlebell')) return null;
  const value = state.settings.loads?.[exerciseId] ?? defaultLoads(ex);
  const unitName = ex.equipment === 'kettlebell' ? t('kettlebell') : t('dumbbell');
  return (
    <div className="loads-setting">
      <Segmented<'1' | '2'>
        label={t('Lifted at once')}
        value={String(value) as '1' | '2'}
        onChange={(v) =>
          update((s) => {
            const loads = { ...s.settings.loads };
            const n = Number(v) as 1 | 2;
            if (n === defaultLoads(ex)) delete loads[exerciseId];
            else loads[exerciseId] = n;
            return { ...s, settings: { ...s.settings, loads } };
          })
        }
        options={[
          { value: '1', label: t('1 {item}', { item: unitName }) },
          { value: '2', label: t('2 {items}', { items: ex.equipment === 'kettlebell' ? t('kettlebells') : t('dumbbells') }) },
        ]}
      />
      <p className="muted small">{t('Log the weight of one {item}. With two, the volume counts both; records and 1RM stay per {item}.', { item: unitName })}</p>
    </div>
  );
}
