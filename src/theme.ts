/** Custom accent colour: one hex picked by the user, adjusted per mode so text and buttons stay readable. */

type RGB = [number, number, number];

export const ACCENTS: { name: string; hex: string }[] = [
  { name: 'Cobalt', hex: '#3d5bff' },
  { name: 'Copper', hex: '#e08a4c' },
  { name: 'Emerald', hex: '#2fbf86' },
  { name: 'Crimson', hex: '#ef4552' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Teal', hex: '#14b8c4' },
  { name: 'Gold', hex: '#f2c230' },
];
export const DEFAULT_ACCENT = ACCENTS[0].hex;

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const mix = (c: RGB, to: RGB, t: number): RGB => c.map((v, i) => v + (to[i] - v) * t) as RGB;

/** Moves the colour toward white (dark mode) or black (light mode) until it reads at 3:1 on the background. */
export function readableOn(hex: string, bg: RGB): string {
  const c = parseHex(hex) ?? parseHex(DEFAULT_ACCENT)!;
  const target: RGB = luminance(bg) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  let out = c;
  for (let t = 0; t <= 1 && contrast(out, bg) < 3; t += 0.05) out = mix(c, target, t);
  return toHex(out);
}
/** Black or white text on top of the accent, whichever contrasts more. */
export function inkFor(hex: string): string {
  const c = parseHex(hex)!;
  return contrast(c, [255, 255, 255]) >= contrast(c, [0, 0, 0]) ? '#ffffff' : '#0d1015';
}

const DARK_BG: RGB = [13, 16, 21];
const LIGHT_BG: RGB = [243, 245, 248];

export function applyAccent(hex: string | undefined, root = document.documentElement) {
  if (!hex || hex.toLowerCase() === DEFAULT_ACCENT) {
    delete root.dataset.accent;
    for (const k of ['--ua-dark', '--ua-dark-ink', '--ua-light', '--ua-light-ink']) root.style.removeProperty(k);
    return;
  }
  const dark = readableOn(hex, DARK_BG);
  const light = readableOn(hex, LIGHT_BG);
  root.style.setProperty('--ua-dark', dark);
  root.style.setProperty('--ua-dark-ink', inkFor(dark));
  root.style.setProperty('--ua-light', light);
  root.style.setProperty('--ua-light-ink', inkFor(light));
  root.dataset.accent = '';
}
