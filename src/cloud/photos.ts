/**
 * Photos of meals, foods and exercises (supabase/photos.sql). Pictures are shrunk on the phone
 * (about 1000 px, JPEG) before upload, kept in the private "photos" bucket, and shown through
 * short-lived signed links cached in memory.
 */
import { getClient } from './cloud';
import { t } from '../i18n';

export type PhotoKind = 'meal' | 'food' | 'exercise';
/** Stored on the item: the file path and when it was last replaced (to refresh cached links). */
export interface PhotoRef {
  path: string;
  at: number;
}

export const photoPath = (uid: string, kind: PhotoKind, id: string) => `${uid}/${kind}/${id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)}.jpg`;

/** Shrinks a picture to at most `max` pixels on its long side and under `maxBytes`, as JPEG. */
export async function shrinkPhoto(file: Blob, max = 1080, maxBytes = 350_000): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  for (const q of [0.8, 0.7, 0.6, 0.5, 0.4]) {
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', q));
    if (blob && (blob.size <= maxBytes || q === 0.4)) return blob;
  }
  throw new Error(t('This picture could not be read. Try a JPEG or PNG.'));
}

async function client() {
  const c = await getClient();
  if (!c) throw new Error(t('Cloud sync is not set up.'));
  return c;
}

const explain = (e: { message: string }) =>
  new Error(
    /failed to fetch|network/i.test(e.message)
      ? t('No connection. Check your internet and try again.')
      : /bucket not found|not found/i.test(e.message)
        ? t('Photos are not switched on on the server yet.')
        : e.message,
  );

/** Uploads (or replaces) the photo of an item and returns its reference. */
export async function uploadPhoto(uid: string, kind: PhotoKind, id: string, file: Blob): Promise<PhotoRef> {
  const blob = await shrinkPhoto(file);
  const path = photoPath(uid, kind, id);
  const { error } = await (await client()).storage.from('photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw explain(error);
  urls.delete(path);
  return { path, at: Date.now() };
}

export async function removePhoto(path: string): Promise<void> {
  const { error } = await (await client()).storage.from('photos').remove([path]);
  urls.delete(path);
  if (error) throw explain(error);
}

/** Removes every photo of this account (before deleting the account). */
export async function removeAllPhotos(uid: string): Promise<void> {
  const c = await client();
  for (const kind of ['meal', 'food', 'exercise']) {
    const { data } = await c.storage.from('photos').list(`${uid}/${kind}`, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${uid}/${kind}/${f.name}`);
    if (paths.length) await c.storage.from('photos').remove(paths);
  }
}

const urls = new Map<string, { url: string; until: number } | null>();

/** A signed link to show a photo (null when there is none or it cannot be seen). */
export async function photoUrl(path: string): Promise<string | null> {
  const hit = urls.get(path);
  if (hit === null) return null;
  if (hit && hit.until > Date.now()) return hit.url;
  try {
    const { data, error } = await (await client()).storage.from('photos').createSignedUrl(path, 3600);
    if (error || !data) {
      urls.set(path, null);
      return null;
    }
    urls.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60000 });
    return data.signedUrl;
  } catch {
    return null;
  }
}
