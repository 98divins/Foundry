import { describe, expect, it, vi } from 'vitest';
import { canAdd, hasPro, requirePro, setPreviewFree } from './pro';

describe('Pro gates', () => {
  it('opens everything during the beta', () => {
    expect(hasPro()).toBe(true);
    expect(canAdd('routines', 50)).toBe(true);
  });
  it('applies free limits in preview mode and asks to upgrade', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] });
    const seen: string[] = [];
    vi.stubGlobal('dispatchEvent', (e: CustomEvent) => seen.push(e.detail));
    setPreviewFree(true);
    expect(canAdd('routines', 3)).toBe(true);
    expect(canAdd('routines', 4)).toBe(false);
    expect(requirePro('excel')).toBe(false);
    expect(seen).toEqual(['routines', 'excel']);
    setPreviewFree(false);
    expect(requirePro('excel')).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('Pro access from the server', () => {
  it('counts only a current Pro plan', async () => {
    const { entitledToPro } = await import('./pro');
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(entitledToPro(null, now)).toBe(false);
    expect(entitledToPro({ plan: 'free', expires_at: null }, now)).toBe(false);
    expect(entitledToPro({ plan: 'pro', expires_at: null }, now)).toBe(true);
    expect(entitledToPro({ plan: 'pro', expires_at: '2026-12-01T00:00:00Z' }, now)).toBe(true);
    expect(entitledToPro({ plan: 'pro', expires_at: '2026-11-01T00:00:00Z' }, now)).toBe(false);
  });
});
