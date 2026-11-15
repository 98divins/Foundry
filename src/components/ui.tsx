import { useEffect, useState, type ReactNode } from 'react';
import { cmToFtIn, fmtClock, ftInToCm, parseTime } from '../utils';
import { t } from '../i18n';

/* ---------- Icons (24px stroke set) ---------- */

const paths = {
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  flame: 'M12 3c.8 3.2 5 5.4 5 10a5 5 0 0 1-10 0c0-2.3 1.1-3.8 2.3-5 .2 1.4.9 2.5 2 3C10.8 8.4 11.2 5.6 12 3z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  x: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6',
  dumbbell: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12',
  history: 'M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  note: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  unlink: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6h14v-6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.8 3 2.7 3 5.5',
  close: 'M6 6l12 12M18 6L6 18',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  play: 'M7 4l13 8-13 8V4z',
  apple: 'M12 7c-1.5-1.2-4-1.4-5.6.2C4.7 8.9 4.6 12 5.7 15c1 2.8 2.8 5 4.5 5 .8 0 1.2-.5 1.8-.5s1 .5 1.8.5c1.7 0 3.5-2.2 4.5-5 1.1-3 1-6.1-.7-7.8C16 5.6 13.5 5.8 12 7zM12 7c0-2 1-3.5 3-4',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  ruler: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  logo: 'M7 6h10l3 13H4zM10 9h5M10 9v7M10 12h4',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'dots' ? 3.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/* ---------- Number input that tolerates half-typed values ("82.", "") ---------- */

function parseNum(text: string): number | null | undefined {
  const t = text.replace(',', '.').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function NumInput({
  value,
  onChange,
  placeholder,
  decimal = true,
  label,
  id,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  label: string;
  id?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    if (parseNum(text) !== value) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      className="num"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const t = decimal ? e.target.value : e.target.value.replace(/[^0-9]/g, '');
        setText(t);
        const n = parseNum(t);
        if (n !== undefined) onChange(n);
      }}
    />
  );
}

/**
 * Time entry that works with a phone's number pad: "90" means 90 s for holds or 90 min for cardio,
 * "1:30" is also accepted. Shown as m:ss once the field loses focus.
 */
export function TimeInput({
  value,
  onChange,
  placeholder,
  plainUnit,
  id,
  className = '',
}: {
  value: number | null;
  onChange: (seconds: number | null) => void;
  placeholder?: string;
  plainUnit: 'sec' | 'min';
  id?: string;
  className?: string;
}) {
  const [text, setText] = useState(value == null ? '' : fmtClock(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value == null ? '' : fmtClock(value));
  }, [value, focused]);
  return (
    <input
      id={id}
      className={'num ' + className}
      inputMode="decimal"
      aria-label={plainUnit === 'sec' ? t('Time (seconds or m:ss)') : t('Time (minutes or h:mm:ss)')}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseTime(e.target.value.replace(',', '.'), plainUnit);
        if (v !== undefined) onChange(v);
      }}
    />
  );
}

/* ---------- Bottom sheet ---------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  tall,
  noClose,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  tall?: boolean;
  /** For choices that must be made: no close button, backdrop taps ignored. */
  noClose?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={noClose ? undefined : onClose}>
      <div
        className={'sheet' + (tall ? ' sheet-tall' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            {!noClose && (
              <button className="icon-btn" onClick={onClose} aria-label={t('Close')}>
                <Icon name="x" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Confirm({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="muted sheet-text">{message}</p>
      <div className="sheet-actions">
        <button className="btn" onClick={onClose}>{t('Cancel')}</button>
        <button
          className={'btn ' + (danger ? 'btn-danger' : 'btn-primary')}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export function Header({
  title,
  onBack,
  right,
}: {
  title: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="top">
      <div className="top-inner">
        {onBack ? (
          <button className="icon-btn" onClick={onBack} aria-label={t('Back')}>
            <Icon name="back" />
          </button>
        ) : (
          <span className="top-spacer" />
        )}
        <h1 className="top-title">{title}</h1>
        <div className="top-right">{right}</div>
      </div>
    </header>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The Foundry mark: an ingot with an F cut out, and a copper spark. Follows the theme colours. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="96 104 330 260" aria-hidden="true">
      <path d="M148 178h216l46 178H102z" fill="var(--accent)" />
      <path d="M206 214h112v36h-74v20h60v34h-60v52h-38z" fill="var(--bg)" />
      <path d="M376 116l14 26 26 14-26 14-14 26-14-26-26-14 26-14z" fill="var(--gold)" />
    </svg>
  );
}

/** Height in the user's unit: one field in cm, or feet + inches. Always reports centimetres. */
export function HeightInput({ cm, unit, onChange, id }: { cm: number; unit: 'cm' | 'in'; onChange: (cm: number) => void; id: string }) {
  if (unit === 'cm') return <NumInput id={id} label={t('Height in cm')} value={cm || null} onChange={(v) => onChange(v ?? 0)} />;
  const { ft, inch } = cmToFtIn(cm);
  return (
    <span className="height-ftin">
      <NumInput id={id + '-ft'} label={t('Feet')} decimal={false} value={cm ? ft : null} onChange={(v) => onChange(ftInToCm(v ?? 0, inch))} />
      <span className="muted small">{t('ft')}</span>
      <NumInput id={id + '-in'} label={t('Inches')} decimal={false} value={cm ? inch : null} onChange={(v) => onChange(ftInToCm(ft, Math.min(11, v ?? 0)))} />
      <span className="muted small">{t('in')}</span>
    </span>
  );
}
