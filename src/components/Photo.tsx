import { useEffect, useRef, useState } from 'react';
import { useCloud } from '../cloud/cloud';
import { photoUrl, removePhoto, uploadPhoto, type PhotoKind, type PhotoRef } from '../cloud/photos';
import { t } from '../i18n';
import { Icon } from './ui';

/** Shows a stored photo (nothing while loading or when it cannot be seen). */
export function PhotoView({ path, at, alt, className = 'photo' }: { path: string; at?: number; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    photoUrl(path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path, at]);
  if (!url) return null;
  return <img className={className} src={url} alt={alt} loading="lazy" decoding="async" />;
}

/** Add, replace or remove the photo of an item. Needs an account (photos are stored online). */
export function PhotoField({ kind, id, value, onChange, label }: { kind: PhotoKind; id: string; value?: PhotoRef | null; onChange: (p: PhotoRef | null) => void; label: string }) {
  const uid = useCloud().user?.id;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!uid) return null;
  const pick = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      onChange(await uploadPhoto(uid, kind, id, file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!value) return;
    setBusy(true);
    try {
      await removePhoto(value.path);
      onChange(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="photo-field">
      {value ? <PhotoView path={value.path} at={value.at} alt={label} /> : null}
      <div className="photo-actions">
        <button type="button" className="btn btn-small" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="plus" size={16} /> {busy ? t('Please wait…') : value ? t('Change photo') : t('Add a photo')}
        </button>
        {value && (
          <button type="button" className="link-btn muted" disabled={busy} onClick={remove}>{t('Remove')}</button>
        )}
      </div>
      <input
        ref={input}
        id={`photo-${kind}-${id}`}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) pick(f);
        }}
      />
      {error && <p className="field-error">{error}</p>}
      <p className="muted small">{kind === 'meal' ? t('Visible to your friends, and to everyone if you share the meal with the community.') : t('Only you can see it.')}</p>
    </div>
  );
}
