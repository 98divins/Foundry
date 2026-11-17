/** Reporting shared content, and hiding what you reported from your own screens. */
export type ReportKind = 'food' | 'meal' | 'comment' | 'profile';
export type ReportReason = 'wrong_values' | 'inappropriate' | 'spam' | 'impersonation' | 'other';

export const hiddenKey = (kind: ReportKind, target: string) => `${kind}:${target}`;

export const isHidden = (hidden: string[] | undefined, kind: ReportKind, target: string) => !!hidden?.includes(hiddenKey(kind, target));

/** The hidden list with one more item (no duplicates, the 500 most recent kept). */
export function withHidden(hidden: string[] | undefined, kind: ReportKind, target: string): string[] {
  const k = hiddenKey(kind, target);
  return [...(hidden ?? []).filter((x) => x !== k), k].slice(-500);
}

/** Reasons offered for each kind of content. */
export const REASONS: Record<ReportKind, ReportReason[]> = {
  food: ['wrong_values', 'inappropriate', 'spam', 'other'],
  meal: ['wrong_values', 'inappropriate', 'spam', 'other'],
  comment: ['inappropriate', 'spam', 'other'],
  profile: ['impersonation', 'inappropriate', 'spam', 'other'],
};
