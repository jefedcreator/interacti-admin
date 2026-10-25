import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { createFakeAdminApi } from '../fake-api/fake-admin-api';
import { FAKE_TOKEN } from '../fake-api/fixture';
import { adminUrls, CORS_HEADERS, installFakeApi } from '../fake-api/playwright';

/** The origins `.env.test` gives Strive and Sara. */
export const STRIVE_ORIGIN = 'https://strive.test';
export const SARA_ORIGIN = 'https://sara.test';
/** The token Sara would accept. It is not the one the tests sign in with, so Sara rejects it. */
const SARA_TOKEN = 'f'.repeat(40);

/** Skip this test unless the current Playwright project is one of the named ones. */
export function only(info: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(info.project.name), `only runs on: ${projects.join(', ')}`);
}

/**
 * Puts the fakes in place (Strive accepting `FAKE_TOKEN`, Sara rejecting it), then signs in at
 * `/signin`. It ends on the overview. A reload keeps the token, so tests may `goto` from here.
 */
export async function signIn(page: Page): Promise<void> {
  await installFakeApi(page, STRIVE_ORIGIN, createFakeAdminApi({ token: FAKE_TOKEN, product: 'strive' }));
  await installFakeApi(page, SARA_ORIGIN, createFakeAdminApi({ token: SARA_TOKEN, product: 'sara' }));

  await page.goto('/signin');
  await page.getByLabel('Admin token').fill(FAKE_TOKEN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
}

/**
 * Waits for every animation and transition that will end: a modal's rise and fade, the page's
 * hover fades. Axe and geometry checks read colours and boxes, which are wrong mid-animation.
 * Skeletons pulse forever, so animations that repeat without end are left alone.
 */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const ending = (): Animation[] =>
      document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity);
    for (let round = 0; round < 5 && ending().length > 0; round += 1) {
      await Promise.allSettled(ending().map((a) => a.finished));
    }
  });
}

/** Answers every save (PUT) with a 422 carrying `message`, as the products do. */
export async function refuseUpdates(page: Page, origin: string, message: string): Promise<void> {
  await page.route(adminUrls(origin), async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 422,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  });
}

/** `/strive/clubs`, loaded: the heading, and the first row's title link. */
export async function openClubs(page: Page): Promise<void> {
  await page.goto('/strive/clubs');
  await expect(page.getByRole('heading', { level: 1, name: /^Clubs/ })).toBeVisible();
  await expect(page.locator('[data-record-link]').first()).toBeVisible();
}

/** Lagos Runners' view, opened over the table from its title link. */
export async function openView(page: Page): Promise<Locator> {
  await page.getByRole('link', { name: 'Lagos Runners', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Lagos Runners' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await settled(page);
  return dialog;
}

/** The create modal, from "New club". */
export async function openCreate(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'New club' }).click();
  const dialog = page.getByRole('dialog', { name: 'New club' });
  await expect(dialog).toBeVisible();
  await settled(page);
  return dialog;
}

/** Lagos Runners' edit modal, from its view's Edit. The view has gone by the time this returns. */
export async function openEdit(page: Page): Promise<Locator> {
  const view = await openView(page);
  await view.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit club' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await settled(page);
  return dialog;
}

/** The edit modal after a save the product refused: "Too short" shows under Name. */
export async function openEditWithError(page: Page): Promise<Locator> {
  await refuseUpdates(page, STRIVE_ORIGIN, 'name: Too short');
  const dialog = await openEdit(page);
  const name = dialog.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('L');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(name).toHaveAccessibleDescription('Too short');
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await settled(page);
  return dialog;
}

/** Lagos Runners' delete modal, from its view's Delete. */
export async function openDelete(page: Page): Promise<Locator> {
  const view = await openView(page);
  await view.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete Lagos Runners?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await settled(page);
  return dialog;
}

export type TabStop = {
  /** What the element is called: its aria-label, id or text. */
  name: string;
  /** Whether it is inside a dialog. */
  inside: boolean;
  outlineStyle: string;
  outlineColor: string;
  outlineWidth: string;
};

/** Presses Tab `count` times and reads, after each press, what has focus and how it is outlined. */
export async function tabStops(page: Page, count: number): Promise<TabStop[]> {
  const stops: TabStop[] = [];
  for (let press = 0; press < count; press += 1) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate((): TabStop => {
        const el = document.activeElement;
        if (!el || el === document.body) {
          return { name: '', inside: false, outlineStyle: '', outlineColor: '', outlineWidth: '' };
        }
        const style = getComputedStyle(el);
        return {
          name:
            el.getAttribute('aria-label') ||
            el.id ||
            (el as HTMLElement).innerText?.trim() ||
            el.tagName.toLowerCase(),
          inside: el.closest('[role="dialog"]') !== null,
          outlineStyle: style.outlineStyle,
          outlineColor: style.outlineColor,
          outlineWidth: style.outlineWidth,
        };
      }),
    );
  }
  return stops;
}

/**
 * Tabs round an open modal, one full turn and more. Every stop must be inside the modal, and drawn
 * with a visible black outline: a style other than none, in `rgb(0, 0, 0)`, with some width.
 */
export async function expectBlackOutlines(page: Page, count = 30): Promise<TabStop[]> {
  const stops = await tabStops(page, count);
  for (const stop of stops) {
    expect(stop.inside, `"${stop.name}" has focus outside the modal`).toBe(true);
    expect(stop.outlineStyle, `"${stop.name}" has no outline`).not.toBe('none');
    expect(parseFloat(stop.outlineWidth), `"${stop.name}" has an outline of no width`).toBeGreaterThan(0);
    expect(stop.outlineColor, `"${stop.name}" is not outlined in black`).toBe('rgb(0, 0, 0)');
  }
  return stops;
}
