import { fold } from './exercises';
import { FR_FOODS } from './foodsFr';
import { FR_FOODS_MORE } from './foodsFrMore';
import { kcalFromMacros, type Food } from './nutrition';
import { t } from './i18n';

/* ---------- Built-in foods ---------- */

export const FR_FOOD_LIST: Food[] = [...FR_FOODS, ...FR_FOODS_MORE].map(([id, name, , kcal, protein, carbs, fat, fiber, label, grams]) => ({
  id,
  name,
  per100: { kcal, protein, carbs, fat, fiber },
  serving: label && grams ? { label, grams } : null,
  source: 'generic',
}));

/** Larger English list (USDA), fetched once on demand: it is not needed to start the app. */
let genericPromise: Promise<Food[]> | null = null;
export function loadGenericFoods(): Promise<Food[]> {
  genericPromise ??= fetch(`${import.meta.env.BASE_URL}foods/generic-en.json`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((data: { rows: [string, number, number, number, number][] }) =>
      data.rows.map(([name, kcal, protein, carbs, fat]) => ({
        // Stable across releases: derived from the name, not the position in the file.
        id: 'g-en-' + fold(name).replace(/[^a-z0-9]+/g, '-'),
        name,
        per100: { kcal, protein, carbs, fat },
        source: 'generic' as const,
      })),
    )
    .catch((e) => {
      genericPromise = null;
      throw e;
    });
  return genericPromise;
}

/**
 * Every word must appear (accents and case ignored); names starting with the first word rank first.
 * `rank` (higher first) comes before the text order: favourites and foods the person eats.
 */
export function searchFoods(list: Food[], query: string, limit = 40, rank?: (f: Food) => number): Food[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: [number, Food][] = [];
  for (const f of list) {
    const hay = fold(`${f.name} ${f.brand ?? ''}`);
    if (!words.every((w) => hay.includes(w))) continue;
    const score = (hay.startsWith(words[0]) ? 0 : 1) + hay.length / 1000 - (rank ? rank(f) : 0) * 10;
    scored.push([score, f]);
  }
  return scored
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map((x) => x[1]);
}

/* ---------- Open Food Facts (open database, ODbL) ---------- */

const OFF_FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_size,serving_quantity';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  generic_name_fr?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(x) ? x : null;
};

/** Maps an Open Food Facts product to a Food, or null when it has no usable nutrition per 100 g. */
export function foodFromOff(p: OffProduct): Food | null {
  const nu = p.nutriments ?? {};
  const protein = n(nu.proteins_100g);
  const carbs = n(nu.carbohydrates_100g);
  const fat = n(nu.fat_100g);
  let kcal = n(nu['energy-kcal_100g']);
  if (kcal == null && n(nu.energy_100g) != null) kcal = Math.round(n(nu.energy_100g)! / 4.184);
  if (kcal == null && protein != null && carbs != null && fat != null) kcal = kcalFromMacros(protein, carbs, fat);
  if (kcal == null) return null;
  const name = (p.product_name_fr || p.product_name || p.generic_name_fr || '').trim();
  if (!name) return null;
  const grams = n(p.serving_quantity);
  return {
    id: 'off-' + (p.code ?? name),
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    per100: { kcal: Math.round(kcal), protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0, fiber: n(nu.fiber_100g) },
    serving: grams && grams > 0 ? { label: p.serving_size || `1 portion`, grams } : null,
    source: 'off',
    barcode: p.code,
  };
}

export class OffError extends Error {}

async function offFetch(url: string, retries = 1): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new OffError(t('No connection to Open Food Facts. Check your internet connection, or add the food yourself.'));
  }
  // Open Food Facts' search is sometimes briefly overloaded: try once more before giving up.
  if ((res.status === 502 || res.status === 503 || res.status === 504) && retries > 0) {
    await new Promise((r) => setTimeout(r, 1500));
    return offFetch(url, retries - 1);
  }
  if (res.status === 404) return null;
  if (res.status === 429) throw new OffError(t('Open Food Facts is limiting searches. Wait a minute and try again.'));
  if (!res.ok) throw new OffError(t('Open Food Facts did not answer (error {code}). Try again later.', { code: res.status }));
  return res.json();
}

/** Product by barcode (EAN/UPC). Null when Open Food Facts does not know it. */
export async function offByBarcode(code: string): Promise<Food | null> {
  const clean = code.replace(/\D/g, '');
  if (clean.length < 6) throw new OffError(t('A barcode has at least 8 digits.'));
  const data = (await offFetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${OFF_FIELDS}`)) as
    | { status?: number; product?: OffProduct }
    | null;
  if (!data || data.status !== 1 || !data.product) return null;
  return foodFromOff({ ...data.product, code: data.product.code ?? clean });
}

/** Text search, French products first. */
export async function offSearch(query: string): Promise<Food[]> {
  const q = encodeURIComponent(query.trim());
  const data = (await offFetch(
    `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=25&fields=${OFF_FIELDS}`,
  )) as { products?: OffProduct[] } | null;
  return (data?.products ?? []).map(foodFromOff).filter((f): f is Food => !!f);
}

/* ---------- What the person eats (plan 4.4) ---------- */

const DAY_MS = 86400000;

/**
 * How likely each food is to be logged now: every past entry counts, recent ones more (half-life
 * about 3 weeks), entries at the same meal more than at other meals, and entries logged near this
 * time of day a little more. Returns food id → score (0 when never logged).
 */
export function foodUsage(
  log: { foodId?: string; meal: string; createdAt: number }[],
  meal: string,
  now = Date.now(),
): Map<string, number> {
  const out = new Map<string, number>();
  const hour = new Date(now).getHours();
  for (const e of log) {
    if (!e.foodId) continue;
    const age = Math.max(0, (now - e.createdAt) / DAY_MS);
    let w = Math.pow(0.5, age / 21);
    w *= e.meal === meal ? 1 : 0.3;
    const h = Math.abs(new Date(e.createdAt).getHours() - hour);
    if (Math.min(h, 24 - h) <= 2) w *= 1.3;
    out.set(e.foodId, (out.get(e.foodId) ?? 0) + w);
  }
  return out;
}
