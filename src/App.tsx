import { applyAccent } from './theme';
import { useEffect } from 'react';
import { Icon, type IconName } from './components/ui';
import { go, useNow, useRoute } from './hooks';
import { ActiveWorkout } from './screens/ActiveWorkout';
import { EditWorkout } from './screens/EditWorkout';
import { ExerciseDetail } from './screens/ExerciseDetail';
import { Exercises } from './screens/Exercises';
import { History } from './screens/History';
import { SettingsPage } from './screens/Settings';
import { Progress } from './screens/Progress';
import { RoutineEditor } from './screens/RoutineEditor';
import { RoutineView } from './screens/RoutineView';
import { ExplorePrograms, ProgramDetail } from './screens/Explore';
import { ImportRoutines } from './screens/ImportRoutines';
import { WorkoutDetail } from './screens/WorkoutDetail';
import { WorkoutTab } from './screens/WorkoutTab';
import { useStore } from './store';
import { CloudDialogs } from './components/Account';
import { ConsentGate } from './components/Legal';
import { QuickStart, Splash, Welcome } from './components/Onboarding';
import { useCloud } from './cloud/cloud';
import { hasData } from './cloud/sync';
import { dayKey, type Meal } from './nutrition';
import { NutritionHome } from './screens/nutrition/NutritionHome';
import { AddFood } from './screens/nutrition/AddFood';
import { MealEditor, MealsPage } from './screens/nutrition/SavedMeals';
import { InsightsPage, PlanPage, WeightPage } from './screens/nutrition/NutritionPages';
import { fmtClock } from './utils';
import { t, tk } from './i18n';

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: '', label: tk('Workout'), icon: 'dumbbell' },
  { path: 'n', label: tk('Nutrition'), icon: 'apple' },
  { path: 'history', label: tk('History'), icon: 'history' },
  { path: 'exercises', label: tk('Exercises'), icon: 'list' },
  { path: 'profile', label: tk('Progress'), icon: 'chart' },
];

export function App() {
  const [section, param, extra, extra2] = useRoute();
  const path = [section, param, extra, extra2].filter(Boolean).join('/');
  // Each screen opens at its top instead of inheriting the previous screen's scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  const { state: themeState } = useStore();
  const theme = themeState.settings.theme ?? 'system';
  // Light / dark override; "system" leaves it to the phone.
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  const accent = themeState.settings.accent;
  const pureBlack = !!themeState.settings.pureBlack;
  useEffect(() => applyAccent(accent), [accent]);
  useEffect(() => {
    if (pureBlack) document.documentElement.dataset.black = '';
    else delete document.documentElement.dataset.black;
  }, [pureBlack]);
  const { state, saveError } = useStore();
  const nutritionDay = section === 'n' && (!param || /^\d{4}-\d{2}-\d{2}$/.test(param));
  const isTab = TABS.some((tab) => tab.path === (section ?? '')) && (section !== 'n' || nutritionDay);
  const now = useNow(1000, !!state.active && section !== 'active');

  const cloud = useCloud();
  // Accounts are required: nothing but the welcome flow until someone is signed in.
  if (cloud.configured) {
    if (!cloud.authReady) return <Splash />;
    if (!cloud.user)
      return (
        <>
          <Welcome />
          <CloudDialogs />
        </>
      );
    // A brand-new, empty account gets the quick start once (after its first sync, so a
    // returning user on a new phone is not asked again).
    if (cloud.initialSynced && !state.settings.onboarded && !hasData(state) && cloud.status !== 'conflict')
      return <QuickStart />;
  }

  let screen;
  switch (section) {
    case 'active':
      screen = <ActiveWorkout />;
      break;
    case 'n':
      if (nutritionDay) screen = <NutritionHome key={param ?? 'today'} date={param ?? dayKey()} />;
      else if (param === 'add') screen = <AddFood key={extra + extra2} date={extra ?? dayKey()} meal={(extra2 ?? 'snacks') as Meal} />;
      else if (param === 'weight') screen = <WeightPage />;
      else if (param === 'insights') screen = <InsightsPage />;
      else if (param === 'meals') screen = extra ? <MealEditor key={extra} id={extra} /> : <MealsPage />;
      else screen = <PlanPage key={param} setup={param === 'setup'} />;
      break;
    case 'history':
      screen = <History />;
      break;
    case 'exercises':
      screen = <Exercises />;
      break;
    case 'profile':
      screen = <Progress />;
      break;
    case 'settings':
      screen = <SettingsPage key={param ?? 'hub'} page={param} />;
      break;
    case 'w':
      screen = <WorkoutDetail key={param} id={param} />;
      break;
    case 'edit':
      screen = <EditWorkout key={param} id={param} />;
      break;
    case 'e':
      screen = <ExerciseDetail key={param} id={param} />;
      break;
    case 'explore':
      screen = param ? <ProgramDetail key={param} id={param} /> : <ExplorePrograms />;
      break;
    case 'rv':
      screen = <RoutineView key={param} id={param} />;
      break;
    case 'import':
      screen = <ImportRoutines key={param} code={param ?? ''} />;
      break;
    case 'r':
      screen = <RoutineEditor key={param + (extra ?? '')} id={param} folderId={extra} />;
      break;
    default:
      screen = <WorkoutTab />;
  }

  return (
    <div key={state.settings.appLang ?? 'auto'} className={'app' + (isTab ? ' with-tabs' : '') + (state.active && section !== 'active' ? ' with-mini' : '')}>
      {saveError && (
        <div className="banner" role="alert">{t('This browser refused to save your data. Export a backup (Progress → Settings) so nothing is lost.')}</div>
      )}
      {screen}
      <CloudDialogs />
      <ConsentGate />
      {state.active && section !== 'active' && (
        <button className="mini-workout" onClick={() => go('active')}>
          <span className="mini-dot" aria-hidden="true" />
          <span className="mini-name">{state.active.name}</span>
          <span className="mini-clock">{fmtClock((now - state.active.startedAt) / 1000)}</span>
          <span className="mini-cta">{t('Resume')}</span>
        </button>
      )}
      {isTab && (
        <nav className="tabs" aria-label={t('Main')}>
          {TABS.map((tab) => {
            const on = (section ?? '') === tab.path;
            return (
              <button
                key={tab.path}
                className={'tab' + (on ? ' on' : '')}
                aria-current={on ? 'page' : undefined}
                onClick={() => go(tab.path, { replace: true })}
              >
                <Icon name={tab.icon} />
                <span>{t(tab.label)}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
