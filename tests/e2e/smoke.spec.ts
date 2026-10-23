import { test, expect } from '@playwright/test';

test('the app loads on black, in Switzer, unindexed', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page).toHaveTitle('interacti admin');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
  for (const weight of [400, 500]) {
    expect(await page.evaluate(async w => (await document.fonts.load(`${w} 16px Switzer`)).length, weight)).toBe(1);
  }
  await expect(page.getByRole('img', { name: 'interacti' })).toBeVisible();
});
