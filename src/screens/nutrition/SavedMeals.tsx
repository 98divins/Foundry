import { useState } from 'react';
import { Confirm, Header, Icon, NumInput, Sheet } from '../../components/ui';
import { back, go } from '../../hooks';
import { applyMealToLog, mealTotals, scaleFood, type Food, type MealItem, type SavedMeal } from '../../nutrition';
import { useNutrition } from '../../store';
import { fmtNum, uid } from '../../utils';
import { AmountSheet, SearchFoods, toggleFavorite } from './AddFood';

const SERVINGS = [0.5, 1, 1.5, 2];

function MealSummary({ items, servings = 1 }: { items: MealItem[]; servings?: number }) {
  const t = mealTotals(items, servings);
  return (
    <span className="muted small">
      {t.kcal} kcal · P {fmtNum(t.protein)} · C {fmtNum(t.carbs)} · F {fmtNum(t.fat)}
    </span>
  );
}

/** "Meals" tab of the add-food screen: pick a saved meal and a number of servings. */
export function SavedMealsList({ onLog }: { onLog: (sm: SavedMeal, servings: number) => void }) {
  const { n } = useNutrition();
  const [picked, setPicked] = useState<SavedMeal | null>(null);
  const [servings, setServings] = useState<number | null>(1);
  const meals = [...n.savedMeals].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {!meals.length && (
        <div className="empty-card">
          <p>
            Save the meals you eat often, then log them in one tap. Create one here, or use “Save as meal” on a meal you
            already logged.
          </p>
        </div>
      )}
      <ul className="food-list">
        {meals.map((m) => (
          <li key={m.id}>
            <button
              className="food-row"
              onClick={() => {
                setServings(1);
                setPicked(m);
              }}
            >
              <span className="entry-text">
                <span className="entry-name">{m.name}</span>
                <MealSummary items={m.items} />
                <span className="muted small meal-items">{m.items.map((i) => i.name).join(', ')}</span>
              </span>
              <Icon name="plus" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-wide" onClick={() => go('n/meals')}>
        <Icon name="edit" size={16} /> Create or edit meals
      </button>

      <Sheet open={!!picked} onClose={() => setPicked(null)} title={picked?.name}>
        {picked && (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!servings) return;
              onLog(picked, servings);
              setPicked(null);
            }}
          >
            <ul className="meal-item-list">
              {picked.items.map((i, k) => (
                <li key={k}>
                  <span>{i.name}</span>
                  <span className="muted small">
                    {i.grams != null ? `${fmtNum(Math.round(i.grams * (servings ?? 1)))} g` : 'quick add'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="chips wrap">
              {SERVINGS.map((s) => (
                <button type="button" key={s} className={'chip' + (servings === s ? ' on' : '')} onClick={() => setServings(s)}>
                  {s === 1 ? '1 serving' : `${s} servings`}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Servings</span>
              <NumInput id="meal-servings" label="Servings" value={servings} onChange={setServings} />
            </label>
            <p className="macro-line">
              <MealSummary items={picked.items} servings={servings ?? 0} />
            </p>
            <div className="sheet-actions">
              <button type="button" className="btn" onClick={() => setPicked(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!servings}>
                Log meal
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}

/** List of saved meals (#/n/meals). */
export function MealsPage() {
  const { n, setN } = useNutrition();
  return (
    <>
      <Header title="My meals" onBack={() => back('n')} />
      <main className="page">
        <button
          className="btn btn-primary btn-wide"
          onClick={() => {
            const id = uid();
            setN((x) => ({ ...x, savedMeals: [...x.savedMeals, { id, name: 'New meal', items: [], updatedAt: Date.now() }] }));
            go('n/meals/' + id);
          }}
        >
          <Icon name="plus" size={18} /> New meal
        </button>
        {!n.savedMeals.length && <p className="muted">No saved meal yet.</p>}
        <ul className="food-list">
          {[...n.savedMeals]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((m) => (
              <li key={m.id}>
                <button className="food-row" onClick={() => go('n/meals/' + m.id)}>
                  <span className="entry-text">
                    <span className="entry-name">{m.name}</span>
                    <MealSummary items={m.items} />
                  </span>
                  <Icon name="chevron" size={18} />
                </button>
              </li>
            ))}
        </ul>
      </main>
    </>
  );
}

/** Edit a saved meal (#/n/meals/<id>). */
export function MealEditor({ id }: { id: string }) {
  const { n, setN } = useNutrition();
  const sm = n.savedMeals.find((m) => m.id === id);
  const [draft, setDraft] = useState<SavedMeal | null>(sm ?? null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [retro, setRetro] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState('');

  if (!sm || !draft) {
    return (
      <>
        <Header title="Meal" onBack={() => back('n/meals')} />
        <main className="page">
          <p className="muted">This meal no longer exists.</p>
        </main>
      </>
    );
  }

  const loggings = new Set(n.log.filter((e) => e.group?.savedMealId === id).map((e) => e.group!.id)).size;

  const save = () => {
    const next = { ...draft, name: draft.name.trim() || 'Meal', updatedAt: Date.now() };
    let changed = 0;
    setN((x) => {
      let log = x.log;
      if (retro) {
        const r = applyMealToLog(x.log, next, uid);
        log = r.log;
        changed = r.groups;
      }
      return { ...x, log, savedMeals: x.savedMeals.map((m) => (m.id === id ? next : m)) };
    });
    setSaved(retro ? `Saved. ${changed || loggings} past logging${(changed || loggings) > 1 ? 's' : ''} updated too.` : 'Saved. Days already logged keep what you ate then.');
    setRetro(false);
  };

  return (
    <>
      <Header
        title="Edit meal"
        onBack={() => back('n/meals')}
        right={
          <button className="btn btn-primary btn-small" onClick={save} disabled={!draft.items.length}>
            Save
          </button>
        }
      />
      <main className="page">
        <label className="field">
          <span>Meal name</span>
          <input id="meal-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <section className="panel">
          <div className="meal-head">
            <h2>Ingredients</h2>
            <MealSummary items={draft.items} />
          </div>
          {!draft.items.length && <p className="muted small">Add the foods that make one serving of this meal.</p>}
          <ul className="meal-item-list editable">
            {draft.items.map((i, k) => (
              <li key={k}>
                <span className="entry-text">
                  <span className="entry-name">{i.name}</span>
                  <span className="muted small">
                    {i.kcal} kcal · P {fmtNum(i.protein)} · C {fmtNum(i.carbs)} · F {fmtNum(i.fat)}
                  </span>
                </span>
                {i.grams != null && (
                  <span className="item-grams">
                    <NumInput
                      id={`item-g-${k}`}
                      label={`Grams of ${i.name}`}
                      value={i.grams}
                      onChange={(g) => {
                        if (!g || !i.grams) return;
                        const r = g / i.grams;
                        const items = [...draft.items];
                        items[k] = {
                          ...i,
                          grams: g,
                          kcal: Math.round(i.kcal * r),
                          protein: Math.round(i.protein * r * 10) / 10,
                          carbs: Math.round(i.carbs * r * 10) / 10,
                          fat: Math.round(i.fat * r * 10) / 10,
                        };
                        setDraft({ ...draft, items });
                      }}
                    />
                    <span className="muted small">g</span>
                  </span>
                )}
                <button
                  className="icon-btn"
                  aria-label={`Remove ${i.name}`}
                  onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== k) })}
                >
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
          {!adding ? (
            <button className="btn btn-wide" onClick={() => setAdding(true)}>
              <Icon name="plus" size={16} /> Add an ingredient
            </button>
          ) : (
            <>
              <SearchFoods foods={n.foods} log={n.log} favorites={n.favorites} onPick={setPicked} />
              <button className="btn btn-ghost btn-wide" onClick={() => setAdding(false)}>
                Close search
              </button>
            </>
          )}
        </section>

        {loggings > 0 && (
          <label className="toggle-line retro">
            <input id="meal-retro" type="checkbox" checked={retro} onChange={(e) => setRetro(e.target.checked)} />
            <span>
              Also update the {loggings} day{loggings > 1 ? 's' : ''} where this meal is already logged. Leave unchecked if
              you changed the recipe from now on: past days keep what you ate then.
            </span>
          </label>
        )}
        {saved && <p className="ok-line">{saved}</p>}

        <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmDelete(true)}>
          Delete meal
        </button>
      </main>

      <AmountSheet
        food={picked}
        favorite={!!picked && n.favorites.includes(picked.id)}
        onToggleFavorite={(f) => setN((x) => toggleFavorite(x, f))}
        addLabel="Add to meal"
        onClose={() => setPicked(null)}
        onAdd={(food, grams) => {
          setDraft({
            ...draft,
            items: [...draft.items, { foodId: food.id, name: food.name, brand: food.brand, grams, ...scaleFood(food, grams) }],
          });
          if (!food.id.startsWith('g-fr-') && !n.foods.some((f) => f.id === food.id)) setN((x) => ({ ...x, foods: [...x.foods, food] }));
          setPicked(null);
          setSaved('');
        }}
      />
      <Confirm
        open={confirmDelete}
        title="Delete meal?"
        message="The saved meal is removed. Days where you logged it keep their foods."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          setN((x) => ({ ...x, savedMeals: x.savedMeals.filter((m) => m.id !== id) }));
          go('n/meals', { replace: true });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
