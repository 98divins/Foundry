/**
 * A fake Supabase for the end-to-end journeys: auth, the synced copy of the data (user_state),
 * profiles and the social tables, answered from memory inside Playwright. Nothing leaves the
 * machine. Each test gets its own instance.
 */
import { test as base, expect, type Page, type Route } from '@playwright/test';
import { HEALTH_CONSENT_VERSION, LEGAL_VERSION } from '../src/legal';

export const USER = {
  id: '44444444-4444-4444-4444-444444444444',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'lifter@example.test',
  app_metadata: {},
  user_metadata: {},
};
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-expose-headers': '*',
};

export class FakeSupabase {
  /** The synced copy of the account's data (null = new account). */
  row: { user_id: string; data: Record<string, unknown>; updated_at: string } | null = null;
  /** Every write of the synced copy, newest last. */
  writes: Record<string, unknown>[] = [];

  constructor(data?: Record<string, unknown>) {
    if (data) this.row = { user_id: USER.id, data, updated_at: new Date(Date.now() - 3600_000).toISOString() };
  }

  async attach(page: Page) {
    // The username was chosen on an earlier visit: skip that step.
    await page.addInitScript((uid) => localStorage.setItem('foundry:has-username:' + uid, '1'), USER.id);
    await page.route(/fake\.supabase\.test/, (route) => this.answer(route));
  }

  private async answer(route: Route) {
    const r = route.request();
    const url = new URL(r.url());
    const p = url.pathname;
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS });
    const json = (x: unknown, status = 200) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(x) });
    let body: Record<string, unknown> | null = null;
    try {
      body = r.postData() ? r.postDataJSON() : null;
    } catch {
      body = null;
    }
    const session = {
      access_token: 't',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'r',
      user: USER,
    };
    if (p === '/auth/v1/token') return json(session);
    if (p === '/auth/v1/signup') return json({ ...session, session });
    if (p === '/auth/v1/user') return json(USER);
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    if (p === '/rest/v1/user_state') {
      const now = new Date().toISOString();
      if (r.method() === 'GET')
        return json(this.row ? [url.searchParams.get('select')?.includes('data') ? this.row : { updated_at: this.row.updated_at }] : []);
      if (r.method() === 'POST' && body) {
        this.row = { user_id: USER.id, data: body.data as Record<string, unknown>, updated_at: now };
        this.writes.push(this.row.data);
        return json([{ updated_at: now }], 201);
      }
      if (r.method() === 'PATCH' && body && this.row) {
        const cond = url.searchParams.get('updated_at');
        if (cond && Date.parse(cond.slice(3)) !== Date.parse(this.row.updated_at)) return json([]);
        this.row = { ...this.row, data: body.data as Record<string, unknown>, updated_at: now };
        this.writes.push(this.row.data);
        return json([{ updated_at: now }]);
      }
    }
    if (p === '/rest/v1/profiles' && r.method() === 'GET') return json([{ user_id: USER.id, username: 'lifter', display_name: 'Lifter', avatar: null }]);
    if (p.startsWith('/rest/v1/')) return json(r.method() === 'GET' ? [] : {});
    if (p.startsWith('/realtime/')) return route.abort();
    return json({});
  }
}

/** Data of an account that has accepted the current terms and already set the app up. */
export function seasoned(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    workouts: [],
    routines: [],
    folders: [],
    customExercises: [],
    active: null,
    rest: null,
    settings: {
      unit: 'kg',
      defaultRest: 90,
      sound: false,
      exerciseLang: 'en',
      appLang: 'en',
      onboarded: true,
      consent: { at: 1, version: LEGAL_VERSION },
      healthConsent: { at: 1, version: HEALTH_CONSENT_VERSION },
    },
    ...extra,
  };
}

/** Signs in with e-mail and password from the welcome screen. */
export async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'I already have an account' }).click();
  await page.fill('#auth-email', USER.email);
  await page.fill('#auth-password', 'correct-horse-battery');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

export const test = base.extend<{ fake: FakeSupabase }>({
  fake: async ({ page }, use) => {
    const fake = new FakeSupabase();
    await fake.attach(page);
    await use(fake);
  },
});
export { expect };
