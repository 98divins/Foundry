import { expect, FakeSupabase, seasoned, signIn, test } from './fake';

test('build a saved workout, then start it: its exercises and targets are there', async ({ page }) => {
  const fake = new FakeSupabase(seasoned());
  await fake.attach(page);
  await signIn(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: /Strength training/ }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByPlaceholder('Search (English or French)').fill('squat');
  await page.getByRole('button', { name: /^Squat \(Barbell\)/ }).click();
  await page.getByRole('button', { name: 'Add 1', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add exercises' })).toBeHidden();
  await page.getByRole('textbox', { name: 'Workout name' }).fill('Leg day');
  await page.getByRole('textbox', { name: /Target reps/ }).fill('8-12');
  await page.getByRole('button', { name: 'Add set' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Leg day').first().click();
  await expect(page.getByText('2 sets · 8-12 reps')).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  // The live workout has the exercise, two sets and the target as a hint in the reps field.
  const card = page.getByRole('region', { name: 'Squat (Barbell)' });
  await expect(card.getByRole('group')).toHaveCount(2);
  await expect(card.getByLabel('Reps').first()).toHaveAttribute('placeholder', '8-12');
  await expect.poll(() => (fake.writes.at(-1)?.routines as { name: string }[] | undefined)?.map((r) => r.name), { timeout: 15_000 }).toEqual(['Leg day']);
});
