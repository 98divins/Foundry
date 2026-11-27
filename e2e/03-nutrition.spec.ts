import { expect, FakeSupabase, seasoned, signIn, test } from './fake';

test('log a food: search it, choose the amount, see it in the day and in the totals', async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10);
  const nutrition = { profile: { sex: 'male', birthYear: 1995, heightCm: 180, activity: 'moderate' }, weights: [{ date: today, kg: 80 }] };
  const fake = new FakeSupabase(seasoned({ nutrition }));
  await fake.attach(page);
  await signIn(page);
  await page.getByRole('navigation').getByText('Nutrition').click();
  await page.getByRole('button', { name: 'Add food to Breakfast' }).click();
  await page.locator('#food-search').fill('banana');
  await page
    .getByRole('button', { name: /^Banana/ })
    .first()
    .click();
  // One banana (120 g) is the default amount.
  const sheet = page.getByRole('dialog', { name: 'Banana' });
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Banana');
  await page.getByRole('button', { name: 'Back' }).click();
  await page
    .getByRole('button', { name: /Breakfast/ })
    .first()
    .click();
  await expect(page.getByText('Banana')).toBeVisible();
  await expect(page.getByText(/1 food · 107 kcal/)).toBeVisible();
  await expect
    .poll(() => ((fake.writes.at(-1)?.nutrition as { log?: { name: string }[] } | undefined)?.log ?? []).map((e) => e.name), { timeout: 15_000 })
    .toEqual(['Banane']); // stored under its built-in name, shown in the app language
});
