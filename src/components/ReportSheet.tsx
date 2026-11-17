import { useState } from 'react';
import { reportContent } from '../cloud/social';
import { t, tk } from '../i18n';
import { REASONS, withHidden, type ReportKind, type ReportReason } from '../reports';
import { useStore } from '../store';
import { Sheet } from './ui';

const REASON_LABEL: Record<ReportReason, string> = {
  wrong_values: tk('Wrong nutrition values'),
  inappropriate: tk('Offensive or inappropriate'),
  spam: tk('Spam or advertising'),
  impersonation: tk('Pretends to be someone else'),
  other: tk('Something else'),
};

export interface ReportTarget {
  kind: ReportKind;
  target: string;
  /** What is shown in the title, e.g. the food's name. */
  label: string;
}

/** Report shared content; it is then hidden from this person's screens. */
export function ReportSheet({ item, onClose }: { item: ReportTarget | null; onClose: () => void }) {
  const { update } = useStore();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const close = () => {
    setReason(null);
    setDetails('');
    setState('idle');
    onClose();
  };
  const send = async () => {
    if (!item || !reason) return;
    setState('sending');
    try {
      await reportContent(item.kind, item.target, reason, details);
      update((s) => ({ ...s, settings: { ...s.settings, hidden: withHidden(s.settings.hidden, item.kind, item.target) } }));
      setState('sent');
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  };
  return (
    <Sheet open={!!item} onClose={close} title={item ? t('Report “{name}”', { name: item.label }) : ''}>
      {item && state === 'sent' ? (
        <div className="form">
          <p>{t('Thank you. We will look at it. You will no longer see it.')}</p>
          <button className="btn btn-primary btn-wide" onClick={close}>
            {t('Close')}
          </button>
        </div>
      ) : item ? (
        <div className="form">
          <div className="menu" role="radiogroup" aria-label={t('Reason')}>
            {REASONS[item.kind].map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                className={'menu-item' + (reason === r ? ' on' : '')}
                onClick={() => setReason(r)}
              >
                {t(REASON_LABEL[r])}
              </button>
            ))}
          </div>
          <label className="field">
            <span>{t('Details (optional)')}</span>
            <textarea id="report-details" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {state === 'error' && <p className="field-error small">{error}</p>}
          <div className="sheet-actions">
            <button className="btn" onClick={close}>
              {t('Cancel')}
            </button>
            <button className="btn btn-primary" disabled={!reason || state === 'sending'} onClick={send}>
              {t('Send the report')}
            </button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

/** Whether something was reported (and so hidden) by this person. */
export function useHidden() {
  const { state } = useStore();
  const hidden = state.settings.hidden;
  return (kind: ReportKind, target: string) => !!hidden?.includes(`${kind}:${target}`);
}
