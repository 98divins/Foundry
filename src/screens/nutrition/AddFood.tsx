import { useCallback, useEffect, useMemo, useState } from 'react';
import { PhotoField } from '../../components/Photo';
import { useFeature } from '../../features';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { Header, Icon, NumInput, Segmented, Sheet } from '../../components/ui';
import { back } from '../../hooks';
import { foodUsage, FR_FOOD_LIST, loadGenericFoods, OffError, offByBarcode, offSearch, searchFoods, foodName, itemName, portionLabel } from '../../foods';
import {
  dayKey,
  entriesFromMeal,
  kcalFromMacros,
  MACRO_LABEL,
  MEAL_LABEL,
  MEALS,
  scaleFood,
  type Food,
  type FoodEntry,
  type Meal,
  type NutritionState,
} from '../../nutrition';
import { SavedMealsList } from './SavedMeals';
import { useCloud } from '../../cloud/cloud';
import { communityFoodByBarcode, publishFood, searchCommunityFoods } from '../../cloud/social';
import { ReportSheet, useHidden } from '../../components/ReportSheet';
import { useNutrition } from '../../store';
import { fmtNum, uid } from '../../utils';
import { fmtDay } from './NutritionHome';
import { lastPortion } from '../../mealCopy';
import { t } from '../../i18n';

type Mode = 'search' | 'meals' | 'scan' | 'quick' | 'create';

export function AddFood({ date, meal: initialMeal }: { date: string; meal: Meal }) {
  const { n, setN } = useNutrition();
  const cloud = useCloud();
  const [mode, setMode] = useState<Mode>('search');
  const [meal, setMeal] = useState<Meal>(MEALS.includes(initialMeal) ? initialMeal : 'snacks');
  const [picked, setPicked] = useState<Food | null>(null);
  const [added, setAdded] = useState<{ name: string; at: number } | null>(null);
  // The confirmation fades on its own; the back arrow returns to the day.
  useEffect(() => {
    if (!added) return;
    const id = setTimeout(() => setAdded(null), 2500);
    return () => clearTimeout(id);
  }, [added]);

  const log = (entry: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'createdAt'>, food?: Food) => {
    setN((x) => ({
      ...x,
      // Keep a copy of foods from outside the built-in list, so they work offline and show in Recent.
      foods: food && !food.id.startsWith('g-fr-') && !x.foods.some((f) => f.id === food.id) ? [...x.foods, food] : x.foods,
      log: [...x.log, { ...entry, id: uid(), date, meal, createdAt: Date.now(), ...(date > dayKey() ? { planned: true } : {}) }],
    }));
    // A scanned Open Food Facts product becomes findable by every member (once, under its barcode).
    if (food?.source === 'off' && cloud.user) publishFood(cloud.user.id, food).catch(() => {});
    setAdded({ name: itemName(entry), at: Date.now() });
  };

  return (
    <>
      <Header title={t('Add to {meal}', { meal: t(MEAL_LABEL[meal]) })} onBack={() => back('n/' + date)} />
      <main className="page">
        <div className="add-meta">
          <span className="muted small">{fmtDay(date)}</span>
          <select id="add-meal" aria-label={t('Meal')} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t(MEAL_LABEL[m])}
              </option>
            ))}
          </select>
        </div>
        <Segmented<Mode>
          label={t('How to add')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'search', label: t('Search') },
            { value: 'meals', label: t('Meals') },
            { value: 'scan', label: t('Scan') },
            { value: 'quick', label: t('Quick') },
          ]}
        />
        {added && (
          <div className="added-toast" role="status" key={added.at}>
            {t('Added:')} {added.name}
          </div>
        )}

        {mode === 'search' && (
          <SearchFoods
            foods={n.foods}
            log={n.log}
            favorites={n.favorites}
            meal={meal}
            onPick={setPicked}
            onCreate={() => setMode('create')}
            onQuick={(food) => {
              // One tap: the amount last logged, else one serving, else 100 g.
              const grams = lastPortion(n.log, food.id) ?? food.serving?.grams ?? 100;
              log({ foodId: food.id, name: food.name, brand: food.brand, grams, ...scaleFood(food, grams) }, food);
            }}
          />
        )}
        {mode === 'meals' && (
          <SavedMealsList
            onLog={(sm, servings) => {
              setN((x) => ({
                ...x,
                log: [...x.log, ...entriesFromMeal(sm, servings, date, meal, uid).map((e) => (date > dayKey() ? { ...e, planned: true } : e))],
              }));
              setAdded({ name: sm.name, at: Date.now() });
            }}
          />
        )}
        {mode === 'scan' && <ScanFood foods={n.foods} onPick={setPicked} onCreate={() => setMode('create')} />}
        {mode === 'quick' && <QuickAdd onAdd={(e) => log(e)} />}
        {mode === 'create' && (
          <CreateFood
            onCreate={(f, share) => {
              setN((x) => ({ ...x, foods: [...x.foods, f] }));
              if (share && cloud.user) publishFood(cloud.user.id, f).catch(() => {});
              setPicked(f);
              setMode('search');
            }}
          />
        )}
      </main>

      <AmountSheet
        food={picked}
        favorite={!!picked && n.favorites.includes(picked.id)}
        onToggleFavorite={(f) => setN((x) => toggleFavorite(x, f))}
        onClose={() => setPicked(null)}
        onAdd={(food, grams) => {
          log({ foodId: food.id, name: food.name, brand: food.brand, grams, ...scaleFood(food, grams) }, food);
          setPicked(null);
        }}
      />
    </>
  );
}

export function FoodRow({
  food,
  onPick,
  favorite,
  onQuick,
  portion,
}: {
  food: Food;
  onPick: (f: Food) => void;
  favorite?: boolean;
  /** When set, the + adds the food at once with its usual amount; tapping the name still opens the amount sheet. */
  onQuick?: (f: Food) => void;
  portion?: number | null;
}) {
  const p = food.per100;
  const grams = portion ?? food.serving?.grams ?? 100;
  return (
    <li className={onQuick ? 'food-row-quick' : undefined}>
      <button className="food-row" onClick={() => onPick(food)}>
        <span className="entry-text">
          <span className="entry-name">
            {favorite && (
              <span className="fav-star" aria-label={t('Favourite')}>
                ★{' '}
              </span>
            )}
            {foodName(food)}
            {food.source === 'custom' && <span className="tag">{t('Mine')}</span>}
            {food.source === 'community' && <span className="tag tag-community">{t('Added by a member')}</span>}
            {food.source === 'off' && <span className="tag tag-off">{t('Data: Open Food Facts')}</span>}
          </span>
          <span className="muted small">
            {food.brand && <>{food.brand} · </>}
            {t('{kcal} kcal · P {p} · C {c} · F {f} per 100 g', { kcal: Math.round(p.kcal), p: fmtNum(p.protein), c: fmtNum(p.carbs), f: fmtNum(p.fat) })}
          </span>
        </span>
        {!onQuick && <Icon name="plus" size={18} />}
      </button>
      {onQuick && (
        <button className="quick-add" onClick={() => onQuick(food)} aria-label={t('Add {g} g of {name}', { g: fmtNum(grams), name: foodName(food) })}>
          <Icon name="plus" size={16} />
          <span>{fmtNum(grams)} g</span>
        </button>
      )}
    </li>
  );
}

export function SearchFoods({
  foods,
  log,
  favorites,
  meal,
  onPick,
  onCreate,
  onQuick,
}: {
  foods: Food[];
  log: FoodEntry[];
  favorites: string[];
  /** The meal being filled: foods often logged at this meal come first. */
  meal?: Meal;
  onPick: (f: Food) => void;
  onCreate?: () => void;
  /** Adds a food at once with its usual amount (lists of foods the person eats). */
  onQuick?: (f: Food) => void;
}) {
  const [query, setQuery] = useState('');
  // Ranked from the log as it was when the screen opened, so rows do not move under the finger while adding.
  const [logAtOpen] = useState(log);
  const [generic, setGeneric] = useState<Food[] | null>(null);
  const [online, setOnline] = useState<{ q: string; foods: Food[] } | null>(null);
  const [busy, setBusy] = useState<'' | 'generic' | 'online'>('');
  const [error, setError] = useState('');

  const local = useMemo(() => {
    const mine = foods.filter((f) => !FR_FOOD_LIST.some((g) => g.id === f.id));
    return [...mine, ...FR_FOOD_LIST];
  }, [foods]);

  const recent = useMemo(() => {
    const byId = new Map(local.map((f) => [f.id, f]));
    const out: Food[] = [];
    for (const e of [...logAtOpen].sort((a, b) => b.createdAt - a.createdAt)) {
      const f = e.foodId ? byId.get(e.foodId) : undefined;
      if (f && !out.includes(f)) out.push(f);
      if (out.length >= 15) break;
    }
    return out;
  }, [local, logAtOpen]);

  const favs = useMemo(() => {
    const byId = new Map(local.map((f) => [f.id, f]));
    return favorites.map((id) => byId.get(id)).filter((f): f is Food => !!f);
  }, [local, favorites]);
  const isFav = (f: Food) => favorites.includes(f.id);

  // Foods this person logs at this meal and time of day (features.ts: smartFoodOrder).
  const smart = useFeature('smartFoodOrder') && !!meal;
  const usage = useMemo(() => (smart && meal ? foodUsage(logAtOpen, meal) : new Map<string, number>()), [smart, logAtOpen, meal]);
  const often = useMemo(() => {
    if (!smart) return [];
    const byId = new Map(local.map((f) => [f.id, f]));
    return [...usage.entries()]
      .filter(([id, u]) => u >= 0.5 && byId.has(id) && !favorites.includes(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => byId.get(id)!);
  }, [smart, usage, local, favorites]);
  const rank = (f: Food) => (isFav(f) ? 100 : 0) + Math.min(usage.get(f.id) ?? 0, 50);

  // Favourites, then foods eaten here, then the best text match.
  const results = query.trim() ? searchFoods(local, query, 40, rank) : [];
  const more = query.trim() && generic ? searchFoods(generic, query, 30).filter((f) => !results.includes(f)) : [];
  // Foods created by other members, searched as you type (after a short pause).
  const [community, setCommunity] = useState<{ q: string; foods: Food[] } | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = setTimeout(() => {
      searchCommunityFoods(q).then(
        (foods) => setCommunity({ q, foods: foods.filter((f) => !local.some((l) => l.id === f.id)) }),
        () => {},
      );
    }, 350);
    return () => clearTimeout(id);
  }, [query, local]);
  const hidden = useHidden();
  const recentShown = recent.filter((f) => !often.includes(f));
  const communityShown = (community && community.q === query.trim() ? community.foods : []).filter((f) => !hidden('food', f.id));

  const loadMore = async () => {
    setBusy('generic');
    setError('');
    try {
      setGeneric(await loadGenericFoods());
    } catch {
      setError(t('The extra food list could not load. Check your connection and try again.'));
    } finally {
      setBusy('');
    }
  };
  const searchOnline = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy('online');
    setError('');
    try {
      setOnline({ q, foods: await offSearch(q) });
    } catch (e) {
      setError(e instanceof OffError ? e.message : t('The search failed. Try again.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <form
        className="search-sticky"
        onSubmit={(e) => {
          e.preventDefault();
          searchOnline();
        }}
      >
        <label className="search">
          <Icon name="search" size={18} />
          <input
            id="food-search"
            placeholder={t('Search a food (e.g. skyr, riz, poulet)')}
            value={query}
            enterKeyHint="search"
            onChange={(e) => {
              setQuery(e.target.value);
              setOnline(null);
            }}
          />
        </label>
      </form>
      {error && <p className="field-error">{error}</p>}

      {!query.trim() && favs.length > 0 && (
        <>
          <h3 className="list-title">{t('Favourites')}</h3>
          <ul className="food-list">
            {favs.map((f) => (
              <FoodRow key={f.id} food={f} onPick={onPick} favorite onQuick={onQuick} portion={lastPortion(log, f.id)} />
            ))}
          </ul>
        </>
      )}
      {!query.trim() && often.length > 0 && (
        <>
          <h3 className="list-title">{t('Often at this meal')}</h3>
          <ul className="food-list">
            {often.map((f) => (
              <FoodRow key={f.id} food={f} onPick={onPick} onQuick={onQuick} portion={lastPortion(log, f.id)} />
            ))}
          </ul>
        </>
      )}
      {!query.trim() && (recentShown.length > 0 || !often.length) && (
        <>
          <h3 className="list-title">{t('Recent')}</h3>
          {recentShown.length ? (
            <ul className="food-list">
              {recentShown.map((f) => (
                <FoodRow key={f.id} food={f} onPick={onPick} favorite={isFav(f)} onQuick={onQuick} portion={lastPortion(log, f.id)} />
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('Foods you log appear here for quick access.')}</p>
          )}
        </>
      )}

      {query.trim() && (
        <>
          <ul className="food-list">
            {results.map((f) => (
              <FoodRow key={f.id} food={f} onPick={onPick} favorite={isFav(f)} />
            ))}
            {more.map((f) => (
              <FoodRow key={f.id} food={f} onPick={onPick} />
            ))}
          </ul>
          {communityShown.length > 0 && (
            <>
              <h3 className="list-title">{t('Community')}</h3>
              <ul className="food-list">
                {communityShown.map((f) => (
                  <FoodRow key={f.id} food={f} onPick={onPick} />
                ))}
              </ul>
            </>
          )}
          {!results.length && !more.length && !communityShown.length && <p className="muted small">{t('No match in your foods or the French list.')}</p>}
          <div className="search-more">
            {!generic && (
              <button className="btn" onClick={loadMore} disabled={busy !== ''}>
                {busy === 'generic' ? t('Loading…') : t('More basic foods (English)')}
              </button>
            )}
            <button className="btn btn-primary" onClick={searchOnline} disabled={busy !== ''}>
              {busy === 'online' ? t('Searching…') : t('Search brands (Open Food Facts)')}
            </button>
            {onCreate && (
              <button className="btn" onClick={onCreate}>
                <Icon name="plus" size={16} /> {t('Create a food from its label')}
              </button>
            )}
          </div>
          {online && online.q === query.trim() && (
            <>
              <h3 className="list-title">{t('Open Food Facts')}</h3>
              {online.foods.length ? (
                <ul className="food-list">
                  {online.foods.map((f) => (
                    <FoodRow key={f.id} food={f} onPick={onPick} />
                  ))}
                </ul>
              ) : (
                <p className="muted small">{t('No product found. Try other words, scan the barcode, or create the food.')}</p>
              )}
            </>
          )}
        </>
      )}
      <p className="muted small credit">
        {t(
          'Basic foods: USDA FoodData Central via TempoLife (tempolife.app, CC-BY-4.0). Brands and barcodes: Open Food Facts (ODbL). Check the label when it matters.',
        )}
      </p>
    </>
  );
}

function ScanFood({ foods, onPick, onCreate }: { foods: Food[]; onPick: (f: Food) => void; onCreate: () => void }) {
  const hidden = useHidden();
  const [camera, setCamera] = useState(true);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<{ text: string; error?: boolean; notFound?: boolean } | null>(null);

  const lookup = useCallback(
    async (raw: string) => {
      const c = raw.replace(/\D/g, '');
      setCode(c);
      setCamera(false);
      const mine = foods.find((f) => f.barcode === c);
      if (mine) return onPick(mine);
      setStatus({ text: t('Looking up {code}…', { code: c }) });
      try {
        // Open Food Facts first: a member-created food must not be able to override a known product.
        // The community copy is only a fallback (product unknown to OFF, or OFF unreachable).
        let food: Food | null = null;
        let offError: unknown = null;
        try {
          food = await offByBarcode(c);
        } catch (e) {
          offError = e;
        }
        food ??= await communityFoodByBarcode(c).then(
          (f) => (f && hidden('food', f.id) ? null : f),
          () => null,
        );
        if (!food && offError) throw offError;
        if (food) {
          setStatus(null);
          onPick(food);
        } else {
          setStatus({ text: t('Barcode {code} is not in Open Food Facts yet.', { code: c }), notFound: true });
        }
      } catch (e) {
        setStatus({ text: e instanceof OffError ? e.message : t('The lookup failed. Try again.'), error: true });
      }
    },
    [foods, onPick],
  );

  return (
    <>
      {camera ? (
        <BarcodeScanner onCode={lookup} onClose={() => setCamera(false)} />
      ) : (
        <button className="btn btn-wide" onClick={() => setCamera(true)}>
          {t('Scan with the camera')}
        </button>
      )}
      <form
        className="barcode-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (code) lookup(code);
        }}
      >
        <input
          id="barcode"
          inputMode="numeric"
          placeholder={t('Or type the barcode digits')}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <button className="btn btn-primary" type="submit" disabled={code.length < 8}>
          {t('Look up')}
        </button>
      </form>
      {status && (
        <p className={status.error ? 'field-error' : 'muted small'}>
          {status.text}{' '}
          {status.notFound && (
            <button className="link-btn" onClick={onCreate}>
              {t('Create it from the label')}
            </button>
          )}
        </p>
      )}
    </>
  );
}

function QuickAdd({ onAdd }: { onAdd: (e: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'createdAt'>) => void }) {
  const [name, setName] = useState('');
  const [v, setV] = useState<{ kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }>({
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  });
  const kcal = v.kcal ?? (v.protein || v.carbs || v.fat ? kcalFromMacros(v.protein ?? 0, v.carbs ?? 0, v.fat ?? 0) : null);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!kcal) return;
        onAdd({ name: name.trim() || t('Quick add'), grams: null, kcal, protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0 });
        setName('');
        setV({ kcal: null, protein: null, carbs: null, fat: null });
      }}
    >
      <label className="field">
        <span>{t('Name (optional)')}</span>
        <input id="quick-name" value={name} placeholder={t('e.g. Restaurant lunch')} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="quick-grid">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="field">
            <span>{k === 'kcal' ? t('Calories') : t('{0} (g)', { 0: t(MACRO_LABEL[k]) })}</span>
            <NumInput
              id={'quick-' + k}
              label={k}
              value={v[k]}
              placeholder={k === 'kcal' && kcal ? String(kcal) : ''}
              onChange={(x) => setV((o) => ({ ...o, [k]: x }))}
            />
          </label>
        ))}
      </div>
      <p className="muted small">{t('Leave calories empty to compute them from the macros (4 / 4 / 9 kcal per gram).')}</p>
      <button className="btn btn-primary btn-wide" type="submit" disabled={!kcal}>
        {t('Add')} {kcal ? `${kcal} kcal` : ''}
      </button>
    </form>
  );
}

function CreateFood({ onCreate }: { onCreate: (f: Food, share: boolean) => void }) {
  const [share, setShare] = useState(true);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [v, setV] = useState<{ kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }>({
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  });
  const [serving, setServing] = useState<{ label: string; grams: number | null }>({ label: '', grams: null });
  const [barcode, setBarcode] = useState('');
  const kcal = v.kcal ?? (v.protein != null || v.carbs != null || v.fat != null ? kcalFromMacros(v.protein ?? 0, v.carbs ?? 0, v.fat ?? 0) : null);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || kcal == null) return;
        onCreate(
          {
            id: 'c-' + uid(),
            name: name.trim(),
            brand: brand.trim() || undefined,
            per100: { kcal, protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0 },
            serving: serving.grams ? { label: serving.label.trim() || t('1 portion'), grams: serving.grams } : null,
            source: 'custom',
            barcode: barcode || undefined,
          },
          share,
        );
      }}
    >
      <label className="field">
        <span>{t('Name')}</span>
        <input id="new-food-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Skyr nature')} />
      </label>
      <label className="field">
        <span>{t('Brand (optional)')}</span>
        <input id="new-food-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <p className="muted small">{t('Values per 100 g, as on the label.')}</p>
      <div className="quick-grid">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="field">
            <span>{k === 'kcal' ? t('Calories') : t('{0} (g)', { 0: t(MACRO_LABEL[k]) })}</span>
            <NumInput
              id={'new-food-' + k}
              label={k}
              value={v[k]}
              placeholder={k === 'kcal' && kcal != null ? String(kcal) : ''}
              onChange={(x) => setV((o) => ({ ...o, [k]: x }))}
            />
          </label>
        ))}
      </div>
      <div className="field-row">
        <label className="field">
          <span>{t('Portion name')}</span>
          <input
            id="new-food-serving"
            value={serving.label}
            placeholder={t('e.g. 1 pot')}
            onChange={(e) => setServing((s) => ({ ...s, label: e.target.value }))}
          />
        </label>
        <label className="field field-narrow">
          <span>{t('Portion (g)')}</span>
          <NumInput id="new-food-serving-g" label={t('Portion in grams')} value={serving.grams} onChange={(g) => setServing((s) => ({ ...s, grams: g }))} />
        </label>
      </div>
      <label className="field">
        <span>{t('Barcode (optional)')}</span>
        <input id="new-food-barcode" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="toggle-line">
        <input id="new-food-share" type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        <span className="small">{t('Add it to the shared food list so every member can find it')}</span>
      </label>
      <button className="btn btn-primary btn-wide" type="submit" disabled={!name.trim() || kcal == null}>
        {t('Create and choose the amount')}
      </button>
    </form>
  );
}

export function AmountSheet({
  food,
  onClose,
  onAdd,
  favorite,
  onToggleFavorite,
  addLabel = t('Add'),
}: {
  food: Food | null;
  onClose: () => void;
  onAdd: (f: Food, grams: number) => void;
  favorite?: boolean;
  onToggleFavorite?: (f: Food) => void;
  addLabel?: string;
}) {
  const [grams, setGrams] = useState<number | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const { n, setN } = useNutrition();
  if (food && food.id !== lastId) {
    setLastId(food.id);
    setGrams(food.serving?.grams ?? 100);
  }
  if (!food) return null;
  const m = scaleFood(food, grams ?? 0);
  const presets = [
    ...(food.serving ? [{ label: portionLabel(food.serving.label), g: food.serving.grams }] : []),
    { label: '100 g', g: 100 },
    ...(food.serving
      ? [{ label: `2 × ${portionLabel(food.serving.label)}`, g: food.serving.grams * 2 }]
      : [
          { label: '50 g', g: 50 },
          { label: '200 g', g: 200 },
        ]),
  ];
  return (
    <Sheet open onClose={onClose} title={foodName(food)}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (grams) onAdd(food, grams);
        }}
      >
        {food.source === 'custom' && (
          <PhotoField
            kind="food"
            id={food.id}
            label={foodName(food)}
            value={n.foods.find((f) => f.id === food.id)?.photo ?? food.photo}
            onChange={(photo) => setN((x) => ({ ...x, foods: x.foods.map((f) => (f.id === food.id ? { ...f, photo } : f)) }))}
          />
        )}
        <div className="amount-head">
          <span className="muted small">{food.brand ?? ''}</span>
          {onToggleFavorite && (
            <button type="button" className={'fav-btn' + (favorite ? ' on' : '')} aria-pressed={favorite} onClick={() => onToggleFavorite(food)}>
              {favorite ? t('★ Favourite') : t('☆ Add to favourites')}
            </button>
          )}
        </div>
        <div className="chips wrap">
          {presets.map((p) => (
            <button type="button" key={p.label} className={'chip' + (grams === p.g ? ' on' : '')} onClick={() => setGrams(p.g)}>
              {p.label}
              {p.label !== `${p.g} g` && <span className="muted"> · {fmtNum(p.g)} g</span>}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t('Amount (g)')}</span>
          <NumInput id="amount-g" label={t('Amount in grams')} value={grams} onChange={setGrams} />
        </label>
        <p className="macro-line">
          <strong>{t('{0} kcal', { 0: m.kcal })}</strong> · {t('P {p} g · C {c} g · F {f} g', { p: fmtNum(m.protein), c: fmtNum(m.carbs), f: fmtNum(m.fat) })}
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!grams}>
            {addLabel}
          </button>
        </div>
        {food.source === 'community' && (
          <button type="button" className="link-btn small report-link" onClick={() => setReporting(true)}>
            {t('Report this food')}
          </button>
        )}
      </form>
      <ReportSheet
        item={reporting ? { kind: 'food', target: food.id, label: foodName(food) } : null}
        onClose={() => {
          setReporting(false);
          onClose();
        }}
      />
    </Sheet>
  );
}

/** Stars or unstars a food; foods from outside the built-in list are kept so the star survives. */
export function toggleFavorite(n: NutritionState, f: Food): NutritionState {
  const on = n.favorites.includes(f.id);
  return {
    ...n,
    favorites: on ? n.favorites.filter((id) => id !== f.id) : [...n.favorites, f.id],
    foods: !on && !f.id.startsWith('g-fr-') && !n.foods.some((x) => x.id === f.id) ? [...n.foods, f] : n.foods,
  };
}
