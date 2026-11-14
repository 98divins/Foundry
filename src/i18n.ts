/**
 * App language. Messages are written in English in the code and looked up in the French dictionary;
 * a missing entry falls back to the English text. `{name}` placeholders are filled from `vars`.
 */
import { FR } from './i18n.fr';

export type AppLang = 'fr' | 'en';

export function detectLang(): AppLang {
  const n = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return n.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let lang: AppLang = detectLang();

export function setLang(l: AppLang) {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}
export const getLang = () => lang;
/** Locale for dates and numbers. */
export const locale = () => (lang === 'fr' ? 'fr-FR' : 'en-GB');

export function t(key: string, vars?: Record<string, string | number>): string {
  const s = lang === 'fr' ? (FR[key] ?? key) : key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Singular or plural message, chosen by count (French treats 0 and 1 as singular). */
export function tp(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  const single = lang === 'fr' ? Math.abs(n) < 2 : n === 1;
  return t(single ? one : other, { n, ...vars });
}

/** Marks a message stored in a constant; translate it with t() where it is shown. */
export const tk = (key: string) => key;
