import { Icon, type IconName } from './components/ui';
import { go, useNow, useRoute } from './hooks';
import { ActiveWorkout } from './screens/ActiveWorkout';
import { EditWorkout } from './screens/EditWorkout';
import { ExerciseDetail } from './screens/ExerciseDetail';
import { Exercises } from './screens/Exercises';
import { History } from './screens/History';
import { Profile } from './screens/Profile';
import { RoutineEditor } from './screens/RoutineEditor';
import { WorkoutDetail } from './screens/WorkoutDetail';
import { WorkoutTab } from './screens/WorkoutTab';
import { useStore } from './store';
import { fmtClock } from './utils';

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: '', label: 'Workout', icon: 'dumbbell' },
  { path: 'history', label: 'History', icon: 'history' },
  { path: 'exercises', label: 'Exercises', icon: 'list' },
  { path: 'profile', label: 'Profile', icon: 'user' },
];

export function App() {
  const [section, param, extra] = useRoute();
  const { state, saveError } = useStore();
  const isTab = TABS.some((t) => t.path === (section ?? ''));
  const now = useNow(1000, !!state.active && section !== 'active');

  let screen;
  switch (section) {
    case 'active':
      screen = <ActiveWorkout />;
      break;
    case 'history':
      screen = <History />;
      break;
    case 'exercises':
      screen = <Exercises />;
      break;
    case 'profile':
      screen = <Profile />;
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
    case 'r':
      screen = <RoutineEditor key={param + (extra ?? '')} id={param} folderId={extra} />;
      break;
    default:
      screen = <WorkoutTab />;
  }

  return (
    <div className={'app' + (isTab ? ' with-tabs' : '') + (state.active && section !== 'active' ? ' with-mini' : '')}>
      {saveError && (
        <div className="banner" role="alert">
          This browser refused to save your data. Export a backup from Profile so nothing is lost.
        </div>
      )}
      {screen}
      {state.active && section !== 'active' && (
        <button className="mini-workout" onClick={() => go('active')}>
          <span className="mini-dot" aria-hidden="true" />
          <span className="mini-name">{state.active.name}</span>
          <span className="mini-clock">{fmtClock((now - state.active.startedAt) / 1000)}</span>
          <span className="mini-cta">Resume</span>
        </button>
      )}
      {isTab && (
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => {
            const on = (section ?? '') === t.path;
            return (
              <button
                key={t.path}
                className={'tab' + (on ? ' on' : '')}
                aria-current={on ? 'page' : undefined}
                onClick={() => go(t.path, { replace: true })}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
