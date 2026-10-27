import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8');

/**
 * `--color-*: initial` in the theme wipes Tailwind's default palette, so a colour class the theme
 * doesn't redeclare compiles to nothing: StatTile would still carry `text-emerald-600` in its
 * markup and the trend arrows would render in plain ink with no colour at all. These tokens are
 * what the green `↑` and red `↓` are painted with.
 */
describe('theme palette', () => {
  it('redeclares the trend colours after the default palette is cleared', () => {
    const cleared = css.indexOf('--color-*: initial');
    expect(cleared).toBeGreaterThan(-1);

    for (const token of [
      '--color-emerald-400:',
      '--color-emerald-600:',
      '--color-rose-400:',
      '--color-rose-600:',
    ]) {
      expect(css.indexOf(token), `${token} must be declared in @theme`).toBeGreaterThan(cleared);
    }
  });
});
