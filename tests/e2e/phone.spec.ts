import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  only,
  openClubs,
  openCreate,
  openDelete,
  openEditWithError,
  openView,
  settled,
  signIn,
} from './helpers';

test.beforeEach(({}, info) => {
  only(info, 'mobile');
});

/** No sideways page scroll. The table's own frame may scroll; the page never does. */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  await settled(page);
  const { scrollWidth, clientWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'the page is wider than the window').toBeLessThanOrEqual(innerWidth);
  // On a phone the window can grow to fit what overflows it, so the layout width is checked too.
  expect(scrollWidth, 'the page is wider than the layout viewport').toBeLessThanOrEqual(clientWidth);
}

/**
 * A modal on a phone is a bottom sheet: its handle shows at the top, and once the overlay is
 * scrolled to its end the content's bottom edge sits on the bottom of the viewport. `primary` is
 * the button that finishes the job; scrolling the overlay must bring it fully into view.
 */
async function expectBottomSheet(page: Page, dialog: Locator, primary: Locator): Promise<void> {
  await settled(page);
  const overlay = dialog.locator('xpath=..');

  await overlay.evaluate((el) => {
    el.scrollTop = 0;
  });
  const handle = dialog.locator(':scope > span[aria-hidden="true"]').first();
  await expect(handle).toBeVisible();
  const grip = await handle.boundingBox();
  expect(grip, 'the handle has no box').not.toBeNull();
  expect(grip?.width).toBeGreaterThan(0);
  expect(grip?.height).toBeGreaterThan(0);
  expect(grip?.y).toBeGreaterThanOrEqual(0);

  await primary.scrollIntoViewIfNeeded();
  await expect(primary).toBeInViewport({ ratio: 1 });

  await overlay.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const gap = await dialog.evaluate((el) =>
    Math.abs(window.innerHeight - el.getBoundingClientRect().bottom),
  );
  expect(gap, "the sheet's bottom edge is off the bottom of the viewport").toBeLessThanOrEqual(1);
  await expect(primary).toBeInViewport({ ratio: 1 });
}

test.describe('375px: no sideways page scroll', () => {
  test('/signin', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByLabel('Admin token')).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test('/', async ({ page }) => {
    await signIn(page);
    await expect(
      page.getByRole('article', { name: 'Strive', exact: true }).getByText('3 resources · 50 records'),
    ).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test('/strive', async ({ page }) => {
    await signIn(page);
    await page.goto('/strive');
    await expect(page.getByRole('main').getByRole('link', { name: /^Clubs/ })).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test('/strive/clubs', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await expectNoSidewaysScroll(page);
  });

  test('an open view', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openView(page);
    await expectNoSidewaysScroll(page);
  });

  test('the open create modal', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openCreate(page);
    await expectNoSidewaysScroll(page);
  });

  test('the open edit modal with a server error showing', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openEditWithError(page);
    await expectNoSidewaysScroll(page);
  });

  test('the open delete modal', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    await openDelete(page);
    await expectNoSidewaysScroll(page);
  });
});

test.describe('375px: modals are bottom sheets', () => {
  test('the view', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    const dialog = await openView(page);
    await expectBottomSheet(page, dialog, dialog.getByRole('button', { name: 'Edit', exact: true }));
  });

  test('the create modal, whose submit is reached by scrolling the overlay', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    const dialog = await openCreate(page);
    await expectBottomSheet(page, dialog, dialog.getByRole('button', { name: 'Create club' }));
  });

  test('the edit modal with a server error', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    const dialog = await openEditWithError(page);
    await expectBottomSheet(page, dialog, dialog.getByRole('button', { name: 'Save changes' }));
  });

  test('the delete modal', async ({ page }) => {
    await signIn(page);
    await openClubs(page);
    const dialog = await openDelete(page);
    await expectBottomSheet(page, dialog, dialog.getByRole('button', { name: 'Cancel' }));
  });
});

test.describe('375px: the menu', () => {
  test('opens full screen, lists the six products, and Harv3st is not a link', async ({ page }) => {
    await signIn(page);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await settled(page);

    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(box, 'the menu has no box').not.toBeNull();
    expect(viewport, 'the page has no viewport').not.toBeNull();
    expect(box?.x).toBeCloseTo(0, 0);
    expect(box?.y).toBeCloseTo(0, 0);
    expect(box?.width).toBeCloseTo(viewport?.width ?? 0, 0);
    expect(box?.height).toBeCloseTo(viewport?.height ?? 0, 0);

    const products = menu.getByRole('navigation', { name: 'Products' });
    await expect(products.getByRole('listitem')).toHaveCount(6);
    for (const name of ['0nbox', 'Strive', 'Parcours', 'Sara', 'Fluid', 'Harv3st']) {
      await expect(products.getByText(name, { exact: true })).toBeVisible();
    }

    await expect(products.getByRole('link', { name: /Harv3st/ })).toHaveCount(0);
    await expect(products.getByRole('link', { name: 'Strive', exact: true })).toBeVisible();

    await expectNoSidewaysScroll(page);
  });
});
