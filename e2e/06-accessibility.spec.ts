import AxeBuilder from '@axe-core/playwright';
import { expect, FakeSupabase, seasoned, signIn, test } from './fake';

// Main screens checked against WCAG 2.1 A/AA rules (axe-core). Both themes: colour contrast differs.
const SCREENS = ['/#/', '/#/n', '/#/friends', '/#/profile', '/#/settings', '/#/history', '/#/exercises', '/#/stats/load', '/#/settings/features'];

for (const theme of ['light', 'dark'] as const) {
  test(`main screens have no accessibility violations (${theme})`, async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const data = seasoned({ nutrition: { profile: { sex: 'female', birthYear: 1992, heightCm: 168, activity: 'light' }, weights: [{ date: today, kg: 62 }] } });
    (data.settings as Record<string, unknown>).theme = theme;
    const fake = new FakeSupabase(data);
    await fake.attach(page);
    await signIn(page);
    await expect(page.getByRole('navigation')).toBeVisible();
    const problems: string[] = [];
    for (const url of SCREENS) {
      await page.goto(url);
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of r.violations)
        problems.push(
          `${url} ${v.id} (${v.impact}): ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' ') + ' — ' + (n.any[0]?.message ?? ''))
            .join(' | ')}`,
        );
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
