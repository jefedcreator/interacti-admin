import { expect, test } from '@playwright/test';
import { only, openClubs, signIn, tabStops } from './helpers';

test.describe('journey: sign in, find, edit, delete, create', () => {
  test('a whole session against the fake API', async ({ page }, info) => {
    only(info, 'desktop', 'reduced');

    // 1. Sign in.
    await signIn(page);

    // 2. The overview: Strive answers, Sara rejects the token.
    const strive = page.getByRole('article', { name: 'Strive', exact: true });
    const sara = page.getByRole('article', { name: 'Sara', exact: true });
    await expect(strive.getByText('3 resources · 50 records')).toBeVisible();
    await expect(sara.getByText('Token rejected')).toBeVisible();

    // 3. Open Strive, then Clubs, and search "lag".
    await strive.getByRole('link', { name: 'Strive', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Strive', exact: true })).toBeVisible();
    await page
      .getByRole('main')
      .getByRole('link', { name: /^Clubs/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: /^Clubs/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Club 05', exact: true })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search clubs' }).fill('lag');
    await expect(page).toHaveURL(/query=lag/);
    await expect(page.getByRole('link', { name: 'Lagos Runners', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Club 05', exact: true })).toHaveCount(0);

    // 4. Open its view, then choose Edit. The edit modal replaces the view.
    await page.getByRole('link', { name: 'Lagos Runners', exact: true }).click();
    const view = page.getByRole('dialog', { name: 'Lagos Runners' });
    await expect(view).toBeVisible();
    await view.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit club' });
    await expect(edit).toBeVisible();
    await expect(view).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(1);

    // 5. Rename it and save. The modal closes, "Saved." shows, the row reads the new name.
    await edit.getByRole('textbox', { name: 'Name', exact: true }).fill('Lagos Night Runners');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(edit).toHaveCount(0);
    await expect(page.getByText('Saved.')).toBeVisible();
    const renamed = page.getByRole('link', { name: 'Lagos Night Runners', exact: true });
    await expect(renamed).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lagos Runners', exact: true })).toHaveCount(0);

    // 6. From the row menu choose Delete, type "delete" and confirm. It is gone from the list.
    const row = page.getByRole('row').filter({ has: renamed });
    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const remove = page.getByRole('dialog', { name: 'Delete Lagos Night Runners?' });
    await expect(remove).toBeVisible();
    await remove.getByLabel('Type delete to confirm').fill('delete');
    await remove.getByRole('button', { name: 'Delete club' }).click();
    await expect(remove).toHaveCount(0);
    await expect(page.getByText('Deleted Lagos Night Runners.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lagos Night Runners', exact: true })).toHaveCount(0);

    // 7. New club: create Night Owls owned by ada@x.co, then choose the toast's View.
    await page.getByRole('button', { name: 'New club' }).click();
    const create = page.getByRole('dialog', { name: 'New club' });
    await expect(create).toBeVisible();
    await create.getByRole('textbox', { name: 'Name', exact: true }).fill('Night Owls');
    await create.getByRole('combobox', { name: /^Owner/ }).fill('ada');
    await create.getByRole('option', { name: 'ada@x.co' }).click();
    await create.getByRole('button', { name: 'Create club' }).click();
    await expect(create).toHaveCount(0);
    await expect(page.getByText('Club created.')).toBeVisible();

    await page.getByRole('button', { name: 'View', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Night Owls' })).toBeVisible();
    await expect(page).toHaveURL(/\/strive\/clubs\/fake-1/);
  });
});

test.describe('keyboard', () => {
  test('reaches a row, opens its view, returns focus, drives the menu and traps the modal', async ({
    page,
  }, info) => {
    only(info, 'desktop');

    await signIn(page);
    await openClubs(page);

    const title = page.locator('[data-record-link]').first();
    const search = page.getByRole('searchbox', { name: 'Search clubs' });

    // From the search field, Tab reaches the first title link. The filter, "New club" and the
    // sortable headers come first, so it takes a few presses, but never a pointer.
    await search.focus();
    let reached = false;
    for (let press = 0; press < 12 && !reached; press += 1) {
      await page.keyboard.press('Tab');
      reached = await title.evaluate((el) => el === document.activeElement);
    }
    expect(reached, 'Tab never reached the first title link').toBe(true);

    // Enter opens its view.
    await page.keyboard.press('Enter');
    const view = page.getByRole('dialog', { name: 'Lagos Runners' });
    await expect(view).toBeVisible();

    // Escape closes it, and focus is back on that same link.
    await page.keyboard.press('Escape');
    await expect(view).toHaveCount(0);
    await expect(title).toBeFocused();
    await expect(title).toHaveAttribute('data-record-link', 'club-01');

    // "Open menu" opens with Enter; ArrowDown moves through View, Edit and Delete.
    const row = page.locator('tbody tr').first();
    await row.getByRole('button', { name: 'Open menu' }).focus();
    await page.keyboard.press('Enter');
    const menuitem = (name: string) => page.getByRole('menuitem', { name, exact: true });
    await expect(menuitem('View')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menuitem('Edit')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menuitem('Delete')).toBeFocused();

    // Back up to Edit and choose it.
    await page.keyboard.press('ArrowUp');
    await expect(menuitem('Edit')).toBeFocused();
    await page.keyboard.press('Enter');
    const edit = page.getByRole('dialog', { name: 'Edit club' });
    await expect(edit).toBeVisible();

    // In the edit modal Tab cycles inside it, and never reaches the table behind. More presses than
    // the modal has stops, so it must have come round to the Close button again.
    const stops = await tabStops(page, 40);
    for (const stop of stops) {
      expect(stop.inside, `"${stop.name}" has focus outside the modal`).toBe(true);
    }
    const names = stops.map((stop) => stop.name);
    expect(names).toContain('Close');
    expect(names).toContain('Save changes');

    // Shift+Tab goes round the other way and stays inside too.
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(
        await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
        'Shift+Tab left the modal',
      ).toBe(true);
    }
  });
});
