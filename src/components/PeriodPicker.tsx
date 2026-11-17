import { useMemo, useState } from 'react';
import { dayKeyAt, rangeOf, type Period, type Range } from '../period';
import { locale, t } from '../i18n';
import { Segmented } from './ui';

export interface Preset {
  days: number;
  label: string;
}

/** Common choices: 4 weeks, 3 months, 6 months, 1 year. */
export const PRESETS_LONG: Preset[] = [
  { days: 28, label: '4 wk' },
  { days: 91, label: '3 mo' },
  { days: 182, label: '6 mo' },
  { days: 365, label: '1 yr' },
];
export const PRESETS_SHORT: Preset[] = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

/** A period chosen on a screen, with its time range and a readable name. */
export function usePeriod(defaultDays: number) {
  const [period, setPeriod] = useState<Period>({ kind: 'last', days: defaultDays });
  const range: Range = useMemo(() => rangeOf(period), [period]);
  return { period, setPeriod, range, name: periodName(period) };
}

export function periodName(p: Period): string {
  if (p.kind === 'last') return p.days >= 36500 ? t('All time') : t('Last {n} days', { n: p.days });
  const f = (d: string) => new Date(d + 'T12:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  return `${f(p.from)} – ${f(p.to)}`;
}

/** Presets plus "Dates" (any from / to, up to today). */
export function PeriodPicker({
  value,
  onChange,
  presets = PRESETS_SHORT,
  id,
}: {
  value: Period;
  onChange: (p: Period) => void;
  presets?: Preset[];
  id: string;
}) {
  const today = dayKeyAt(Date.now());
  const current = value.kind === 'dates' ? 'dates' : String(value.days);
  return (
    <div className="period-picker">
      {presets.length > 0 && (
        <Segmented<string>
          label={t('Period')}
          value={current}
          onChange={(v) => {
            if (v !== 'dates') return onChange({ kind: 'last', days: Number(v) });
            const r = rangeOf(value);
            onChange({ kind: 'dates', from: dayKeyAt(r.from), to: dayKeyAt(r.to - 1) });
          }}
          options={[...presets.map((p) => ({ value: String(p.days), label: t(p.label) })), { value: 'dates', label: t('Dates') }]}
        />
      )}
      {value.kind === 'dates' && (
        <div className="date-range">
          <label className="field">
            <span>{t('From')}</span>
            <input
              id={id + '-from'}
              type="date"
              value={value.from}
              max={value.to}
              onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
            />
          </label>
          <label className="field">
            <span>{t('To')}</span>
            <input
              id={id + '-to'}
              type="date"
              value={value.to}
              min={value.from}
              max={today}
              onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
