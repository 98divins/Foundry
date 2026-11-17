import { devices } from '@playwright/test';
import { expect, FakeSupabase, seasoned, signIn, test } from './fake';

test('data stays on the phone offline and reaches a second device', async ({ browser }) => {
  const fake = new FakeSupabase(seasoned());
  const phone = await browser.newContext({ ...devices['iPhone 13'], locale: 'en-US' });
  const a = await phone.newPage();
  await fake.attach(a);
  await signIn(a);
  await a.goto('/#/settings/profile');
  await a.locator('#profile-name').fill('Sam');
  await a.locator('#profile-bio').fill('Squats on Mondays');
  // Typed right after signing in, during the first sync: both fields reach the account.
  await expect.poll(() => fake.writes.at(-1)?.profile, { timeout: 15_000 }).toMatchObject({ name: 'Sam', bio: 'Squats on Mondays' });

  // Offline: the server cannot be reached, the data is still there after a reload.
  await a.unroute(/fake\.supabase\.test/);
  await a.route(/fake\.supabase\.test/, (r) => r.abort('internetdisconnected'));
  await a.reload();
  await a.goto('/#/settings/profile');
  await expect(a.locator('#profile-bio')).toHaveValue('Squats on Mondays');

  // A second device signs in and gets the same data.
  const tablet = await browser.newContext({ ...devices['iPad Mini'], locale: 'en-US' });
  const b = await tablet.newPage();
  await fake.attach(b);
  await signIn(b);
  await b.goto('/#/settings/profile');
  await expect(b.locator('#profile-name')).toHaveValue('Sam');
  await phone.close();
  await tablet.close();
});
