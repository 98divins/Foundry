import { LEGAL_VERSION } from '../src/legal';
import { expect, signIn, test } from './fake';

test('a new account sets its preferences, accepts the terms and its choices are saved to the account', async ({ page, fake }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Your preferences' })).toBeVisible();
  await page.getByRole('radio', { name: '4' }).click();
  await page.getByRole('radio', { name: 'lb' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Where do you start?')).toBeVisible();
  await page.getByRole('button', { name: 'Skip, take me to the app' }).click();
  const terms = page.getByRole('dialog', { name: 'Before you continue' });
  await expect(terms).toBeVisible();
  for (const box of await terms.getByRole('checkbox').all()) await box.check();
  await terms.getByRole('button', { name: 'Accept and continue' }).click();
  await expect(terms).toBeHidden();
  await expect(page.getByRole('navigation').getByText('Workout')).toBeVisible();
  // The choices reach the account (synced copy), with the accepted terms.
  await expect
    .poll(() => fake.writes.at(-1)?.settings, { timeout: 15_000 })
    .toMatchObject({ unit: 'lb', onboarded: true, consent: { version: LEGAL_VERSION } });
});
