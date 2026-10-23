import type { TestInfo } from '@playwright/test';
import { test } from '@playwright/test';

/** Skip this test unless the current Playwright project is one of the named ones. */
export function only(info: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(info.project.name), `only runs on: ${projects.join(', ')}`);
}
