import { expect, FakeSupabase, seasoned, signIn, test } from './fake';

test('log a workout: add an exercise, complete a set, finish, find it in the history', async ({ page }) => {
  const fake = new FakeSupabase(seasoned());
  await fake.attach(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Start an empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page
    .getByRole('searchbox')
    .or(page.getByPlaceholder(/search/i))
    .first()
    .fill('bench press');
  await page.getByRole('button', { name: /^Bench Press \(Barbell\)/ }).click();
  await page.getByRole('button', { name: 'Add 1', exact: true }).click();
  const card = page.getByRole('region', { name: 'Bench Press (Barbell)' });
  await card.getByLabel('Weight').first().fill('80');
  await card.getByLabel('Reps').first().fill('8');
  await card.getByRole('button', { name: 'Complete set' }).first().click();
  await expect(page.getByText('640 kg').first()).toBeVisible(); // volume: 80 × 8
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Workout done. Nice work!')).toBeVisible();
  await expect(page.getByText('80 kg × 8')).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByText('Evening workout').first()).toBeVisible();
  // Saved to the account too.
  await expect
    .poll(() => (fake.writes.at(-1)?.workouts as { endedAt: number | null }[] | undefined)?.filter((w) => w.endedAt).length, { timeout: 15_000 })
    .toBe(1);
});
