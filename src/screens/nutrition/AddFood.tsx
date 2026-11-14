import { useCallback, useMemo, useState } from 'react';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { Header, Icon, NumInput, Segmented, Sheet } from '../../components/ui';
import { back } from '../../hooks';
import { FR_FOOD_LIST, loadGenericFoods, OffError, offByBarcode, offSearch, searchFoods } from '../../foods';
import {
  entriesFromMeal,
  kcalFromMacros,
  MEAL_LABEL,
  MEALS,
  scaleFood,
  type Food,
  type FoodEntry,
  type Meal,
  type NutritionState,
} from '../../nutrition';
import { SavedMealsList } from './SavedMeals';
import { useNutrition } from '../../store';
import { fmtNum, uid } from '../../utils';
import { fmtDay } from './NutritionHome';

type Mode = 'search' | 'meals' | 'scan' | 'quick' | 'create';

export function AddFood({ date, meal: initialMeal }: { date: string; meal: Meal }) {
  const { n, setN } = useNutrition();
  const [mode, setMode] = useState<Mode>('search');
  const [meal, setMeal] = useState<Meal>(MEALS.includes(initialMeal) ? initialMeal : 'snacks');
  const [picked, setPicked] = useState<Food | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const log = (entry: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'createdAt'>, food?: Food) => {
    setN((x) => ({
      ...x,
      // Keep a copy of foods from outside the built-in list, so they work offline and show in Recent.
      foods: food && !food.id.startsWith('g-fr-') && !x.foods.some((f) => f.id === food.id) ? [...x.foods, food] : x.foods,
      log: [...x.log, { ...entry, id: uid(), date, meal, createdAt: Date.now() }],
    }));
    setAdded((a) => [...a, entry.name]);
  };

  return (
    <>
      <Header title={`Add to ${MEAL_LABEL[meal]}`} onBack={() => back('n/' + date)} />
      <main className="page">
        <div className="add-meta">
          <span className="muted small">{fmtDay(date)}</span>
          <select id="add-meal" aria-label="Meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <Segmented<Mode>
          label="How to add"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'search', label: 'Search' },
            { value: 'meals', label: 'Meals' },
            { value: 'scan', label: 'Scan' },
            { value: 'quick', label: 'Quick' },
            { value: 'create', label: 'New' },
          ]}
        />
        {added.length > 0 && (
          <div className="added-box" role="status">
            <span>
              Added: {added.slice(-3).join(', ')}
              {added.length > 3 && ` and ${added.length - 3} more`}
            </span>
            <button className="btn btn-small btn-primary" onClick={() => back('n/' + date)}>
              Done
            </button>
          </div>
        )}

        {mode === 'search' && <SearchFoods foods={n.foods} log={n.log} favorites={n.favorites} onPick={setPicked} />}
        {mode === 'meals' && (
          <SavedMealsList
            onLog={(sm, servings) => {
              setN((x) => ({ ...x, log: [...x.log, ...entriesFromMeal(sm, servings, date, meal, uid)] }));
              setAdded((a) => [...a, sm.name]);
            }}
          />
        )}
        {mode === 'scan' && <ScanFood foods={n.foods} onPick={setPicked} onCreate={() => setMode('create')} />}
        {mode === 'quick' && <QuickAdd onAdd={(e) => log(e)} />}
        {mode === 'create' && (
          <CreateFood
            onCreate={(f) => {
              setN((x) => ({ ...x, foods: [...x.foods, f] }));
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

export function FoodRow({ food, onPick, favorite }: { food: Food; onPick: (f: Food) => void; favorite?: boolean }) {
  const p = food.per100;
  return (
    <li>
      <button className="food-row" onClick={() => onPick(food)}>
        <span className="entry-text">
          <span className="entry-name">
            {favorite && <span className="fav-star" aria-label="Favourite">★ </span>}
            {food.name}
            {food.source === 'custom' && <span className="tag">Mine</span>}
          </span>
          <span className="muted small">
            {food.brand && <>{food.brand} · </>}
            {Math.round(p.kcal)} kcal · P {fmtNum(p.protein)} · C {fmtNum(p.carbs)} · F {fmtNum(p.fat)} per 100 g
          </span>
        </span>
        <Icon name="plus" size={18} />
      </button>
    </li>
  );
}

export function SearchFoods({
  foods,
  log,
  favorites,
  onPick,
}: {
  foods: Food[];
  log: FoodEntry[];
  favorites: string[];
  onPick: (f: Food) => void;
}) {
  const [query, setQuery] = useState('');
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
    for (const e of [...log].sort((a, b) => b.createdAt - a.createdAt)) {
      const f = e.foodId ? byId.get(e.foodId) : undefined;
      if (f && !out.includes(f)) out.push(f);
      if (out.length >= 15) break;
    }
    return out;
  }, [local, log]);

  const favs = useMemo(() => {
    const byId = new Map(local.map((f) => [f.id, f]));
    return favorites.map((id) => byId.get(id)).filter((f): f is Food => !!f);
  }, [local, favorites]);
  const isFav = (f: Food) => favorites.includes(f.id);

  const results = query.trim() ? searchFoods(local, query) : [];
  // Favourites first among matches.
  results.sort((a, b) => Number(isFav(b)) - Number(isFav(a)));
  const more = query.trim() && generic ? searchFoods(generic, query, 30).filter((f) => !results.includes(f)) : [];

  const loadMore = async () => {
    setBusy('generic');
    setError('');
    try {
      setGeneric(await loadGenericFoods());
    } catch {
      setError('The extra food list could not load. Check your connection and try again.');
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
      setError(e instanceof OffError ? e.message : 'The search failed. Try again.');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          searchOnline();
        }}
      >
        <label className="search">
          <Icon name="search" size={18} />
          <input
            id="food-search"
            placeholder="Search a food (e.g. skyr, riz, poulet)"
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
          <h3 className="list-title">Favourites</h3>
          <ul className="food-list">
            {favs.map((f) => (
              <FoodRow key={f.id} food={f} onPick={onPick} favorite />
            ))}
          </ul>
        </>
      )}
      {!query.trim() && (
        <>
          <h3 className="list-title">Recent</h3>
          {recent.length ? (
            <ul className="food-list">
              {recent.map((f) => (
                <FoodRow key={f.id} food={f} onPick={onPick} favorite={isFav(f)} />
              ))}
            </ul>
          ) : (
            <p className="muted small">Foods you log appear here for quick access.</p>
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
          {!results.length && !more.length && <p className="muted small">No match in your foods or the French list.</p>}
          <div className="search-more">
            {!generic && (
              <button className="btn" onClick={loadMore} disabled={busy !== ''}>
                {busy === 'generic' ? 'Loading…' : 'More basic foods (English)'}
              </button>
            )}
            <button className="btn btn-primary" onClick={searchOnline} disabled={busy !== ''}>
              {busy === 'online' ? 'Searching…' : 'Search brands (Open Food Facts)'}
            </button>
          </div>
          {online && online.q === query.trim() && (
            <>
              <h3 className="list-title">Open Food Facts</h3>
              {online.foods.length ? (
                <ul className="food-list">
                  {online.foods.map((f) => (
                    <FoodRow key={f.id} food={f} onPick={onPick} />
                  ))}
                </ul>
              ) : (
                <p className="muted small">No product found. Try other words, scan the barcode, or create the food.</p>
              )}
            </>
          )}
        </>
      )}
      <p className="muted small credit">
        Basic foods: USDA FoodData Central via TempoLife (tempolife.app, CC-BY-4.0). Brands and barcodes: Open Food Facts
        (ODbL). Check the label when it matters.
      </p>
    </>
  );
}

function ScanFood({ foods, onPick, onCreate }: { foods: Food[]; onPick: (f: Food) => void; onCreate: () => void }) {
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
      setStatus({ text: `Looking up ${c}…` });
      try {
        const food = await offByBarcode(c);
        if (food) {
          setStatus(null);
          onPick(food);
        } else {
          setStatus({ text: `Barcode ${c} is not in Open Food Facts yet.`, notFound: true });
        }
      } catch (e) {
        setStatus({ text: e instanceof OffError ? e.message : 'The lookup failed. Try again.', error: true });
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
          Scan with the camera
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
          placeholder="Or type the barcode digits"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <button className="btn btn-primary" type="submit" disabled={code.length < 8}>
          Look up
        </button>
      </form>
      {status && (
        <p className={status.error ? 'field-error' : 'muted small'}>
          {status.text}{' '}
          {status.notFound && (
            <button className="link-btn" onClick={onCreate}>
              Create it from the label
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
        onAdd({ name: name.trim() || 'Quick add', grams: null, kcal, protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0 });
        setName('');
        setV({ kcal: null, protein: null, carbs: null, fat: null });
      }}
    >
      <label className="field">
        <span>Name (optional)</span>
        <input id="quick-name" value={name} placeholder="e.g. Restaurant lunch" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="quick-grid">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="field">
            <span>{k === 'kcal' ? 'Calories' : `${k} (g)`}</span>
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
      <p className="muted small">Leave calories empty to compute them from the macros (4 / 4 / 9 kcal per gram).</p>
      <button className="btn btn-primary btn-wide" type="submit" disabled={!kcal}>
        Add {kcal ? `${kcal} kcal` : ''}
      </button>
    </form>
  );
}

function CreateFood({ onCreate }: { onCreate: (f: Food) => void }) {
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
        onCreate({
          id: 'c-' + uid(),
          name: name.trim(),
          brand: brand.trim() || undefined,
          per100: { kcal, protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0 },
          serving: serving.grams ? { label: serving.label.trim() || '1 portion', grams: serving.grams } : null,
          source: 'custom',
          barcode: barcode || undefined,
        });
      }}
    >
      <label className="field">
        <span>Name</span>
        <input id="new-food-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Skyr nature" />
      </label>
      <label className="field">
        <span>Brand (optional)</span>
        <input id="new-food-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <p className="muted small">Values per 100 g, as on the label.</p>
      <div className="quick-grid">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="field">
            <span>{k === 'kcal' ? 'Calories' : `${k} (g)`}</span>
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
          <span>Portion name</span>
          <input
            id="new-food-serving"
            value={serving.label}
            placeholder="e.g. 1 pot"
            onChange={(e) => setServing((s) => ({ ...s, label: e.target.value }))}
          />
        </label>
        <label className="field field-narrow">
          <span>Portion (g)</span>
          <NumInput
            id="new-food-serving-g"
            label="Portion in grams"
            value={serving.grams}
            onChange={(g) => setServing((s) => ({ ...s, grams: g }))}
          />
        </label>
      </div>
      <label className="field">
        <span>Barcode (optional)</span>
        <input id="new-food-barcode" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))} />
      </label>
      <button className="btn btn-primary btn-wide" type="submit" disabled={!name.trim() || kcal == null}>
        Create and choose the amount
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
  addLabel = 'Add',
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
  if (food && food.id !== lastId) {
    setLastId(food.id);
    setGrams(food.serving?.grams ?? 100);
  }
  if (!food) return null;
  const m = scaleFood(food, grams ?? 0);
  const presets = [
    ...(food.serving ? [{ label: food.serving.label, g: food.serving.grams }] : []),
    { label: '100 g', g: 100 },
    ...(food.serving ? [{ label: `2 × ${food.serving.label}`, g: food.serving.grams * 2 }] : [{ label: '50 g', g: 50 }, { label: '200 g', g: 200 }]),
  ];
  return (
    <Sheet open onClose={onClose} title={food.name}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (grams) onAdd(food, grams);
        }}
      >
        <div className="amount-head">
          <span className="muted small">{food.brand ?? ''}</span>
          {onToggleFavorite && (
            <button
              type="button"
              className={'fav-btn' + (favorite ? ' on' : '')}
              aria-pressed={favorite}
              onClick={() => onToggleFavorite(food)}
            >
              {favorite ? '★ Favourite' : '☆ Add to favourites'}
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
          <span>Amount (g)</span>
          <NumInput id="amount-g" label="Amount in grams" value={grams} onChange={setGrams} />
        </label>
        <p className="macro-line">
          <strong>{m.kcal} kcal</strong> · P {m.protein} g · C {m.carbs} g · F {m.fat} g
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!grams}>
            {addLabel}
          </button>
        </div>
      </form>
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
