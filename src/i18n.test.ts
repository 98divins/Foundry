import { describe, expect, it } from 'vitest';
import { FR } from './i18n.fr';
import { setLang, t, tp } from './i18n';

/** Every literal message in the code: t('…'), tk('…') and both forms of tp(n, '…', '…'). */
function messages(): string[] {
  const sources = import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./i18n*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const str = String.raw`'((?:[^'\\]|\\.)*)'`;
  const single = new RegExp(String.raw`\b(?:t|tk)\(\s*` + str, 'g');
  const plural = new RegExp(String.raw`\btp\([^,]+,\s*` + str + String.raw`,\s*` + str, 'g');
  const out = new Set<string>();
  const un = (s: string) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  for (const s of Object.values(sources)) {
    for (const m of s.matchAll(single)) out.add(un(m[1]));
    for (const m of s.matchAll(plural)) out.add(un(m[1])).add(un(m[2]));
  }
  return [...out];
}

// Messages that read the same in both languages.
const SAME = new Set(['Foundry', 'Nutrition', 'kg', 'lb', 'cm', 'ft / in', 'ft', 'in', 'km', 'miles', 'Français', 'English', 'Muscle', 'Superset', 'min', 'Volume', 'Volume (t)', 'Volume (k lb)', 'Calories', 'Date', 'Notes', 'Routine', 'Mode', 'Bio', 'FAQ', 'Records', 'Plan', 'kcal', 'Distance', 'Version {0}', 'Open Food Facts', 'Full Body', 'Full Body A', 'Full Body B', 'Push / Pull / Legs', 'Push', 'Pull', 'Legs', 'routine', '{v} pts', '{0} kcal', '{0} g/kg', '{n} routine', '{n} routines', 'Portion (g)', '1 portion', 'Rechercher (FR ou EN)', 'Tous les muscles', 'Tout l’équipement', 'Sessions', 'Cobalt', 'Violet', 'D', 'Total']);

describe('French translation', () => {
  it('has every message used in the app', () => {
    expect(messages().length).toBeGreaterThan(600);
    const missing = messages().filter((m) => !(m in FR) && !SAME.has(m));
    expect(missing).toEqual([]);
  });
  it('keeps the same placeholders', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const off = Object.entries(FR).filter(([en, fr]) => ph(en) !== ph(fr) && !/^(Finish and save the|Also update the|Delete folder and its) \{n\}/.test(en));
    expect(off).toEqual([]);
  });
  it('switches language and fills placeholders', () => {
    setLang('fr');
    expect(t('Workout')).toBe('Séance');
    expect(t('Add to {meal}', { meal: 'Dîner' })).toBe('Ajouter (Dîner)');
    expect(tp(1, '{n} workout', '{n} workouts')).toBe('1 séance');
    expect(tp(0, '{n} workout', '{n} workouts')).toBe('0 séance');
    expect(tp(3, '{n} workout', '{n} workouts')).toBe('3 séances');
    setLang('en');
    expect(t('Workout')).toBe('Workout');
    expect(tp(0, '{n} workout', '{n} workouts')).toBe('0 workouts');
  });
});
