import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  expectBlackOutlines,
  openClubs,
  openCreate,
  openDelete,
  openEdit,
  openEditWithError,
  openView,
  settled,
  signIn,
} from './helpers';

/** Axe over the page as it stands. Colour and boxes are read once the animations have ended. */
async function expectNoViolations(page: Page): Promise<void> {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`).join('\n'),
  ).toEqual([]);
}

test.describe('axe: no violations', () => {
  test('/sign-in', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByLabel('Admin token')).toBeVisible();
    await expectNoViolations(page);
  });

  test('/', async ({ page }) => {
    await signIn(page);
    const strive = page.getByRole('article', { name: 'Strive', exact: true });
    await expect(strive.getByText('3 resources · 50 records')).toBeVisible();
    await expect(
      page.getByRole('article', { name: 'Sara', exact: true }).getByText('Token rejected'),
    ).toBeVisible();
    await expectNoViolations(page);
  });

  test('/strive', async ({ page }) => {
    await signIn(page);
    await page.goto('/strive');
    await expect(page.getByRole('main').getByRole('link', { name: /^Clubs/ })).toBeVisible();
    await expectNoViolations(page);
  });

  test('/strive/clubs', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await expectNoViolations(page);
  });

  test('an open view', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openView(page);
    await expectNoViolations(page);
  });

  test('the open create modal', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openCreate(page);
    await expectNoViolations(page);
  });

  test('the open edit modal with a server error showing', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openEditWithError(page);
    await expectNoViolations(page);
  });

  test('the open delete modal', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openDelete(page);
    await expectNoViolations(page);
  });
});

test.describe('focus outlines in modals: black, on white', () => {
  test('the view', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openView(page);
    await expectBlackOutlines(page);
  });

  test('the create modal', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openCreate(page);
    await expectBlackOutlines(page);
  });

  test('the edit modal', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openEdit(page);
    await expectBlackOutlines(page);
  });

  test('the delete modal', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openDelete(page);
    await expectBlackOutlines(page);
  });
});
