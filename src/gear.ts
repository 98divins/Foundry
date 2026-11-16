/** The user's equipment ("gear"): one item per slot, shown around their silhouette on the profile. */
import { tk } from './i18n';

export const GEAR_SLOTS = [
  'belt', 'gloves', 'straps', 'wraps', 'knees', 'elbows',
  'shoes', 'top', 'bottoms', 'shaker', 'bag', 'headphones', 'watch',
] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

export interface GearItem {
  brand: string;
  model: string;
  /** Optional: colour, size, why you like it… */
  note?: string;
}
export type Gear = Partial<Record<GearSlot, GearItem>>;

export const GEAR_LABEL: Record<GearSlot, string> = {
  belt: tk('Belt'),
  gloves: tk('Gloves'),
  straps: tk('Lifting straps'),
  wraps: tk('Wrist wraps'),
  knees: tk('Knee sleeves'),
  elbows: tk('Elbow sleeves'),
  shoes: tk('Shoes'),
  top: tk('Top'),
  bottoms: tk('Shorts / leggings'),
  shaker: tk('Shaker'),
  bag: tk('Gym bag'),
  headphones: tk('Headphones'),
  watch: tk('Watch'),
};

/** Where each slot sits on the board: left column, right column, bottom row. */
export const GEAR_LAYOUT: { left: GearSlot[]; right: GearSlot[]; bottom: GearSlot[] } = {
  left: ['headphones', 'top', 'gloves', 'wraps', 'shaker'],
  right: ['watch', 'belt', 'straps', 'elbows', 'bag'],
  bottom: ['bottoms', 'knees', 'shoes'],
};

/** Simple line icons (24×24, stroke) drawn for Foundry. */
export const GEAR_ICON: Record<GearSlot, string> = {
  belt: 'M3 9h18v6H3zM10 9v6M14 9v6M10 12h4',
  gloves: 'M7 21v-7L5 11V7a1 1 0 0 1 2 0v3V5a1 1 0 0 1 2 0v5V4a1 1 0 0 1 2 0v6V5a1 1 0 0 1 2 0v8l2-2a1.4 1.4 0 0 1 2 2l-4 5v3',
  straps: 'M8 3v10a4 4 0 0 0 8 0V3M8 7h8M12 17v4',
  wraps: 'M6 8h12v8H6zM6 11h12M9 8v8M15 16l3 4',
  knees: 'M8 3v7l-1 4v7M16 3v7l1 4v7M7 11h10M7 15h10',
  elbows: 'M4 8l8 4 8-4M6 12l6 3 6-3M12 15v6',
  shoes: 'M3 17v-4l4-1 3-4 3 2 3 2 5 1v4zM3 17h18',
  top: 'M8 4l-5 3 2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 0 1-8 0',
  bottoms: 'M6 4h12l1 16h-5l-2-9-2 9H5z',
  shaker: 'M8 7h8l-1 13H9zM9 3h6v4H9zM8 11h8',
  bag: 'M4 9h16v10H4zM9 9V6h6v3M4 13h16',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z',
  watch: 'M8 7l1-4h6l1 4M8 17l1 4h6l1-4M7 7h10v10H7zM12 10v2l1.5 1.5',
};

export const gearCount = (g: Gear | undefined) => GEAR_SLOTS.filter((s) => g?.[s]?.brand || g?.[s]?.model).length;

/** Keep only sane, short values (also used on gear received from other people). */
export function cleanGear(g: unknown): Gear {
  const out: Gear = {};
  if (!g || typeof g !== 'object') return out;
  for (const s of GEAR_SLOTS) {
    const v = (g as Record<string, unknown>)[s] as Partial<GearItem> | undefined;
    if (!v || typeof v !== 'object') continue;
    const brand = String(v.brand ?? '').trim().slice(0, 40);
    const model = String(v.model ?? '').trim().slice(0, 60);
    const note = String(v.note ?? '').trim().slice(0, 120);
    if (brand || model) out[s] = { brand, model, ...(note ? { note } : {}) };
  }
  return out;
}
