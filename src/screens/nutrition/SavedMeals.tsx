import { PlanSheet } from './PlanSheet';
import { itemName } from '../../foods';
import { PhotoField, PhotoView } from '../../components/Photo';
import { photoPath } from '../../cloud/photos';
import { useEffect, useState } from 'react';
import { Confirm, Header, Icon, NumInput, Segmented, Sheet } from '../../components/ui';
import { ideaItems, MEAL_IDEAS, type IdeaTag, type MealIdea } from '../../mealIdeas';
import { back, go } from '../../hooks';
import { applyMealToLog, entriesFromMeal, mealTotals, scaleFood, type Food, type MealItem, type SavedMeal } from '../../nutrition';
import { useNutrition } from '../../store';
import { useCloud } from '../../cloud/cloud';
import { loadSharedMeals, shareMeal, SocialNotReady, unshareMeal, type SharedMeal } from '../../cloud/social';
import { fmtNum, uid } from '../../utils';
import { AmountSheet, SearchFoods, toggleFavorite } from './AddFood';
import { t, tk, tp } from '../../i18n';
import { canAdd, requirePro } from '../../pro';
import { ReportSheet, useHidden } from '../../components/ReportSheet';

const SERVINGS = [0.5, 1, 1.5, 2];

function MealSummary({ items, servings = 1 }: { items: MealItem[]; servings?: number }) {
  const tot = mealTotals(items, servings);
  return (
    <span className="muted small">
      {t('{0} kcal · P {1} · C {2} · F {3}', { 0: tot.kcal, 1: fmtNum(tot.protein), 2: fmtNum(tot.carbs), 3: fmtNum(tot.fat) })}
    </span>
  );
}

/** "Meals" tab of the add-food screen: pick a saved meal and a number of servings. */
export function SavedMealsList({ onLog, exclude, addLabel }: { onLog: (sm: SavedMeal, servings: number) => void; exclude?: string; addLabel?: string }) {
  const { n } = useNutrition();
  const [picked, setPicked] = useState<SavedMeal | null>(null);
  const [servings, setServings] = useState<number | null>(1);
  const [by, setBy] = useState<'servings' | 'grams'>('servings');
  const [grams, setGrams] = useState<number | null>(null);
  // Weight of the whole recipe (items logged by weight), so a sauce can be logged by the gram.
  const recipeGrams = picked ? picked.items.reduce((a, i) => a + (i.grams ?? 0), 0) : 0;
  const factor = by === 'grams' ? (grams && recipeGrams ? grams / recipeGrams : null) : servings;
  const meals = n.savedMeals.filter((m) => m.id !== exclude).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {!meals.length && (
        <div className="empty-card">
          <p>{t('Save the meals you eat often, then log them in one tap. Create one here, or use “Save as meal” on a meal you already logged.')}</p>
        </div>
      )}
      <ul className="food-list">
        {meals.map((m) => (
          <li key={m.id}>
            <button
              className="food-row"
              onClick={() => {
                setServings(1);
                setBy('servings');
                setGrams(null);
                setPicked(m);
              }}
            >
              <span className="entry-text">
                {m.photo && <PhotoView path={m.photo.path} at={m.photo.at} alt="" className="photo photo-thumb" />}
                <span className="entry-name">{m.name}</span>
                <MealSummary items={m.items} />
                <span className="muted small meal-items">{m.items.map(itemName).join(', ')}</span>
              </span>
              <Icon name="plus" size={18} />
            </button>
          </li>
        ))}
      </ul>
      {!exclude && (
        <button className="btn btn-wide" onClick={() => go('n/meals')}>
          <Icon name="edit" size={16} /> {t('Create or edit meals')}
        </button>
      )}

      <Sheet open={!!picked} onClose={() => setPicked(null)} title={picked?.name}>
        {picked && (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!factor) return;
              onLog(picked, Math.round(factor * 1000) / 1000);
              setPicked(null);
            }}
          >
            {picked.photo && <PhotoView path={picked.photo.path} at={picked.photo.at} alt={picked.name} />}
            <ul className="meal-item-list">
              {picked.items.map((i, k) => (
                <li key={k}>
                  <span>{itemName(i)}</span>
                  <span className="muted small">{i.grams != null ? `${fmtNum(Math.round(i.grams * (factor ?? 1)))} g` : t('quick add')}</span>
                </li>
              ))}
            </ul>
            {recipeGrams > 0 && (
              <Segmented<'servings' | 'grams'>
                label={t('Amount')}
                value={by}
                onChange={(v) => {
                  if (v === 'grams' && !grams) setGrams(Math.round(recipeGrams * (servings ?? 1)));
                  setBy(v);
                }}
                options={[
                  { value: 'servings', label: t('Servings') },
                  { value: 'grams', label: t('Grams') },
                ]}
              />
            )}
            {by === 'grams' && recipeGrams > 0 ? (
              <>
                <label className="field">
                  <span>{t('Grams eaten')}</span>
                  <NumInput id="meal-grams" label={t('Grams eaten')} value={grams} onChange={setGrams} />
                </label>
                <p className="muted small">
                  {t('The whole recipe weighs {g} g. Weigh your portion and enter it here.', { g: fmtNum(Math.round(recipeGrams)) })}
                </p>
              </>
            ) : (
              <>
                <div className="chips wrap">
                  {SERVINGS.map((s) => (
                    <button type="button" key={s} className={'chip' + (servings === s ? ' on' : '')} onClick={() => setServings(s)}>
                      {s === 1 ? t('1 serving') : t('{n} servings', { n: s })}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>{t('Servings')}</span>
                  <NumInput id="meal-servings" label={t('Servings')} value={servings} onChange={setServings} />
                </label>
              </>
            )}
            <p className="macro-line">
              <MealSummary items={picked.items} servings={factor ?? 0} />
            </p>
            <div className="sheet-actions">
              <button type="button" className="btn" onClick={() => setPicked(null)}>
                {t('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={!factor}>
                {addLabel ?? t('Log meal')}
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
  const [planning, setPlanning] = useState<SavedMeal | null>(null);
  const [tab, setTab] = useState<'mine' | 'explore'>(n.savedMeals.length ? 'mine' : 'explore');
  const [added, setAdded] = useState<string[]>([]);
  const [source, setSource] = useState<'ideas' | 'community'>('ideas');
  return (
    <>
      <Header title={t('Meals')} onBack={() => back('n')} />
      <main className="page">
        <Segmented<'mine' | 'explore'>
          label={t('Meals')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mine', label: t('My meals') },
            { value: 'explore', label: t('Explore meals') },
          ]}
        />
        {tab === 'explore' ? (
          <>
            <Segmented<'ideas' | 'community'>
              label={t('Source')}
              value={source}
              onChange={setSource}
              options={[
                { value: 'ideas', label: t('Foundry ideas') },
                { value: 'community', label: t('Community') },
              ]}
            />
            {source === 'community' ? (
              <CommunityMeals
                added={added}
                onAdd={(m) => {
                  if (!canAdd('savedMeals', n.savedMeals.length)) return;
                  const id = uid();
                  setN((x) => ({ ...x, savedMeals: [...x.savedMeals, { id, name: m.name, items: m.items, updatedAt: Date.now() }] }));
                  setAdded((a) => [...a, m.user_id + m.meal_id]);
                }}
                onPlan={(m) => setPlanning({ id: 'idea-' + m.meal_id, name: m.name, items: m.items, updatedAt: 0 })}
              />
            ) : (
              <MealIdeasList
                added={added}
                onAdd={(idea) => {
                  if (!canAdd('savedMeals', n.savedMeals.length)) return;
                  const id = uid();
                  setN((x) => ({ ...x, savedMeals: [...x.savedMeals, { id, name: t(idea.name), items: ideaItems(idea), updatedAt: Date.now() }] }));
                  setAdded((a) => [...a, idea.id]);
                }}
                onPlan={(idea) => setPlanning({ id: 'idea-' + idea.id, name: t(idea.name), items: ideaItems(idea), updatedAt: 0 })}
              />
            )}
          </>
        ) : (
          <>
            <button
              className="btn btn-primary btn-wide"
              onClick={() => {
                if (!canAdd('savedMeals', n.savedMeals.length)) return;
                const id = uid();
                setN((x) => ({ ...x, savedMeals: [...x.savedMeals, { id, name: t('New meal'), items: [], updatedAt: Date.now() }] }));
                go('n/meals/' + id);
              }}
            >
              <Icon name="plus" size={18} /> {t('New meal')}
            </button>
            {!n.savedMeals.length && <p className="muted">{t('No saved meal yet.')}</p>}
            <ul className="food-list">
              {[...n.savedMeals]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((m) => (
                  <li key={m.id}>
                    <div className="entry-line">
                      <button className="food-row" onClick={() => go('n/meals/' + m.id)}>
                        <span className="entry-text">
                          <span className="entry-name">
                            {m.name}
                            {m.shared && <span className="tag shared-tag">{t('Shared')}</span>}
                          </span>
                          <MealSummary items={m.items} />
                        </span>
                        <Icon name="chevron" size={18} />
                      </button>
                      <button className="btn btn-small" disabled={!m.items.length} onClick={() => setPlanning(m)}>
                        {t('Plan it')}
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </>
        )}
      </main>
      {planning && (
        <PlanSheet
          open
          onClose={() => setPlanning(null)}
          title={t('Plan “{name}”', { name: planning.name })}
          defaultMeal="lunch"
          make={(d, meal) =>
            entriesFromMeal(planning, 1, d, meal, uid).map((e) =>
              planning.id.startsWith('idea-') ? { ...e, group: e.group && { ...e.group, savedMealId: '' } } : e,
            )
          }
        />
      )}
    </>
  );
}

/** Edit a saved meal (#/n/meals/<id>). */
export function MealEditor({ id }: { id: string }) {
  const { n, setN } = useNutrition();
  const [addingMeal, setAddingMeal] = useState(false);
  const cloud = useCloud();
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
        <Header title={t('Meal')} onBack={() => back('n/meals')} />
        <main className="page">
          <p className="muted">{t('This meal no longer exists.')}</p>
        </main>
      </>
    );
  }

  const loggings = new Set(n.log.filter((e) => e.group?.savedMealId === id).map((e) => e.group!.id)).size;

  const save = () => {
    const next = { ...draft, name: draft.name.trim() || t('Meal'), updatedAt: Date.now() };
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
    setSaved(
      retro
        ? tp(changed || loggings, 'Saved. {n} past logging updated too.', 'Saved. {n} past loggings updated too.')
        : t('Saved. Days already logged keep what you ate then.'),
    );
    setRetro(false);
    // Keep the community copy in step with the meal.
    if (cloud.user) {
      const job = next.shared ? shareMeal(cloud.user.id, next) : sm?.shared ? unshareMeal(cloud.user.id, next.id) : null;
      job?.catch((e: Error) => setSaved(t('Saved on your account, but sharing failed: {e}', { e: e.message })));
    }
  };

  return (
    <>
      <Header
        title={t('Edit meal')}
        onBack={() => back('n/meals')}
        right={
          <button className="btn btn-primary btn-small" onClick={save} disabled={!draft.items.length}>
            {t('Save')}
          </button>
        }
      />
      <main className="page">
        <PhotoField
          kind="meal"
          id={draft.id}
          label={draft.name}
          value={draft.photo}
          onChange={(photo) => {
            // Saved at once: the file is already stored.
            setDraft((d) => (d ? { ...d, photo } : d));
            setN((x) => ({ ...x, savedMeals: x.savedMeals.map((m) => (m.id === id ? { ...m, photo } : m)) }));
          }}
        />
        <label className="field">
          <span>{t('Meal name')}</span>
          <input id="meal-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="setting panel">
          <span>
            {t('Share with the community')}
            <br />
            <span className="muted small">
              {draft.shared ? t('Other members see this meal in Meals → Explore → Community, with your first name.') : t('Private: only you see this meal.')}
            </span>
          </span>
          <input
            id="meal-shared"
            type="checkbox"
            className="switch"
            checked={!!draft.shared}
            onChange={(e) => (!e.target.checked || requirePro('shareMeals')) && setDraft({ ...draft, shared: e.target.checked })}
          />
        </label>
        <section className="panel">
          <div className="meal-head">
            <h2>{t('Ingredients')}</h2>
            <MealSummary items={draft.items} />
          </div>
          {!draft.items.length && <p className="muted small">{t('Add the foods that make one serving of this meal.')}</p>}
          <ul className="meal-item-list editable stacked">
            {draft.items.map((i, k) => (
              <li key={k}>
                <span className="entry-text">
                  <span className="entry-name">{itemName(i)}</span>
                  <span className="muted small">
                    {t('{0} kcal · P {1} · C {2} · F {3}', { 0: i.kcal, 1: fmtNum(i.protein), 2: fmtNum(i.carbs), 3: fmtNum(i.fat) })}
                  </span>
                </span>
                {i.grams != null && (
                  <span className="item-grams">
                    <NumInput
                      id={`item-g-${k}`}
                      label={t('Grams of {name}', { name: itemName(i) })}
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
                  aria-label={t('Remove {name}', { name: itemName(i) })}
                  onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== k) })}
                >
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
          {!adding ? (
            <button className="btn btn-wide" onClick={() => setAdding(true)}>
              <Icon name="plus" size={16} /> {t('Add an ingredient')}
            </button>
          ) : (
            <>
              <SearchFoods foods={n.foods} log={n.log} favorites={n.favorites} onPick={setPicked} />
              <button className="btn btn-ghost btn-wide" onClick={() => setAdding(false)}>
                {t('Close search')}
              </button>
            </>
          )}
        </section>

        <button className="btn btn-wide" onClick={() => setAddingMeal(true)}>
          <Icon name="plus" size={16} /> {t('Add a saved meal (sauce, base…)')}
        </button>
        <Sheet open={addingMeal} onClose={() => setAddingMeal(false)} title={t('Add a saved meal')} tall>
          <SavedMealsList
            exclude={id}
            addLabel={t('Add to meal')}
            onLog={(sm, k) => {
              const tot = mealTotals(sm.items, k);
              const g = sm.items.reduce((a, i) => a + (i.grams ?? 0), 0) * k;
              setDraft({ ...draft, items: [...draft.items, { foodId: 'meal-' + sm.id, name: sm.name, grams: g > 0 ? Math.round(g) : null, ...tot }] });
              setAddingMeal(false);
              setSaved('');
            }}
          />
        </Sheet>

        {loggings > 0 && (
          <label className="toggle-line retro">
            <input id="meal-retro" type="checkbox" checked={retro} onChange={(e) => setRetro(e.target.checked)} />
            <span>
              {tp(
                loggings,
                'Also update the {n} day where this meal is already logged. Leave unchecked if you changed the recipe from now on: past days keep what you ate then.',
                'Also update the {n} days where this meal is already logged. Leave unchecked if you changed the recipe from now on: past days keep what you ate then.',
              )}
            </span>
          </label>
        )}
        {saved && <p className="ok-line">{saved}</p>}

        <button className="btn btn-ghost-danger btn-wide" onClick={() => setConfirmDelete(true)}>
          {t('Delete meal')}
        </button>
      </main>

      <AmountSheet
        food={picked}
        favorite={!!picked && n.favorites.includes(picked.id)}
        onToggleFavorite={(f) => setN((x) => toggleFavorite(x, f))}
        addLabel={t('Add to meal')}
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
        title={t('Delete meal?')}
        message={t('The saved meal is removed. Days where you logged it keep their foods.')}
        confirmLabel={t('Delete')}
        danger
        onConfirm={() => {
          setN((x) => ({ ...x, savedMeals: x.savedMeals.filter((m) => m.id !== id) }));
          if (sm?.shared && cloud.user) unshareMeal(cloud.user.id, id).catch(() => {});
          go('n/meals', { replace: true });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

const TAG_LABEL: Record<IdeaTag, string> = { breakfast: tk('Breakfast'), main: tk('Main meal'), snack: tk('Snack'), veggie: tk('Vegetarian') };

/** Classic, balanced meal ideas: add one to My meals or plan it straight away. */
function MealIdeasList({ added, onAdd, onPlan }: { added: string[]; onAdd: (m: MealIdea) => void; onPlan: (m: MealIdea) => void }) {
  const [tag, setTag] = useState<IdeaTag | 'all'>('all');
  const shown = MEAL_IDEAS.filter((m) => tag === 'all' || m.tags.includes(tag));
  return (
    <>
      <p className="muted small">{t('Simple, balanced meals to start from. Add one to My meals to change the amounts, or plan it directly.')}</p>
      <div className="chips">
        {(['all', 'breakfast', 'main', 'snack', 'veggie'] as const).map((k) => (
          <button key={k} className={'chip' + (tag === k ? ' on' : '')} onClick={() => setTag(k)}>
            {k === 'all' ? t('All') : t(TAG_LABEL[k])}
          </button>
        ))}
      </div>
      <ul className="routine-list">
        {shown.map((m) => {
          const items = ideaItems(m);
          return (
            <li key={m.id}>
              <div className="program-card">
                <span className="program-tags small">
                  {m.tags.map((x) => (
                    <span key={x} className="tag">
                      {t(TAG_LABEL[x])}
                    </span>
                  ))}
                  <span className="muted">{t('{n} min', { n: m.minutes })}</span>
                </span>
                <span className="program-name">{t(m.name)}</span>
                <span className="muted small">{t(m.description)}</span>
                <MealSummary items={items} />
                <span className="small muted">{items.map((i) => `${itemName(i)} ${fmtNum(i.grams ?? 0)} g`).join(' · ')}</span>
                <div className="btn-grid">
                  <button className="btn btn-small" disabled={added.includes(m.id)} onClick={() => onAdd(m)}>
                    {added.includes(m.id) ? t('Added to My meals') : t('Add to My meals')}
                  </button>
                  <button className="btn btn-small btn-primary" onClick={() => onPlan(m)}>
                    {t('Plan it')}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Meals other members chose to share. */
function CommunityMeals({ added, onAdd, onPlan }: { added: string[]; onAdd: (m: SharedMeal) => void; onPlan: (m: SharedMeal) => void }) {
  const cloud = useCloud();
  const [meals, setMeals] = useState<SharedMeal[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!cloud.user) return;
    loadSharedMeals(cloud.user.id).then(setMeals, (e: Error) => {
      setError(e instanceof SocialNotReady ? t('Community meals are not switched on on the server yet.') : e.message);
      setMeals([]);
    });
  }, [cloud.user]);
  const hidden = useHidden();
  const [reporting, setReporting] = useState<SharedMeal | null>(null);
  const query = q.trim().toLowerCase();
  const shown = (meals ?? [])
    .filter((m) => !hidden('meal', m.user_id + '/' + m.meal_id))
    .filter((m) => !query || m.name.toLowerCase().includes(query) || m.items.some((i) => itemName(i).toLowerCase().includes(query)));
  return (
    <>
      <p className="muted small">{t('Meals shared by other members. Share yours from its edit page.')}</p>
      {meals && meals.length > 4 && (
        <label className="search">
          <Icon name="search" size={18} />
          <input id="community-search" type="search" placeholder={t('Search a meal or an ingredient')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      {meals === null && <p className="muted">{t('Loading…')}</p>}
      {error && <p className="field-error small">{error}</p>}
      {meals && !meals.length && !error && (
        <div className="empty-card">
          <p>{t('No shared meal yet. Be the first: open one of your meals and switch on Share with the community.')}</p>
        </div>
      )}
      <ul className="routine-list">
        {shown.map((m) => {
          const key = m.user_id + m.meal_id;
          return (
            <li key={key}>
              <div className="program-card">
                <span className="program-tags small">
                  <span className="muted">{t('By {name}', { name: m.author || t('A member') })}</span>
                </span>
                <PhotoView path={photoPath(m.user_id, 'meal', m.meal_id)} alt={m.name} className="photo photo-card" />
                <span className="program-name">{m.name}</span>
                <MealSummary items={m.items} />
                <span className="small muted">{m.items.map((i) => (i.grams != null ? `${itemName(i)} ${fmtNum(i.grams)} g` : itemName(i))).join(' · ')}</span>
                <div className="btn-grid">
                  <button className="btn btn-small" disabled={added.includes(key)} onClick={() => onAdd(m)}>
                    {added.includes(key) ? t('Added to My meals') : t('Add to My meals')}
                  </button>
                  <button className="btn btn-small btn-primary" onClick={() => onPlan(m)}>
                    {t('Plan it')}
                  </button>
                </div>
                <button className="link-btn small report-link" onClick={() => setReporting(m)}>
                  {t('Report')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <ReportSheet
        item={reporting ? { kind: 'meal', target: reporting.user_id + '/' + reporting.meal_id, label: reporting.name } : null}
        onClose={() => setReporting(null)}
      />
    </>
  );
}
