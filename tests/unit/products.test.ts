import { describe, expect, it } from 'vitest';
import { buildProducts, canSendToken, productBySlug, resolveConnection } from '@/config/products';

describe('resolveConnection', () => {
  const notConfigured = { state: 'not-configured', envVar: 'VITE_API_X' };

  it('is not-configured when the value is missing or empty', () => {
    expect(resolveConnection(undefined, 'VITE_API_X', true)).toEqual(notConfigured);
    expect(resolveConnection('', 'VITE_API_X', true)).toEqual(notConfigured);
  });

  it('is ready for an https origin and strips the trailing slash', () => {
    expect(resolveConnection('https://parcours.live/', 'VITE_API_X', true)).toEqual({
      state: 'ready',
      apiBase: 'https://parcours.live',
    });
  });

  it('is ready for http on localhost and 127.0.0.1', () => {
    expect(resolveConnection('http://localhost:3001', 'VITE_API_X', true).state).toBe('ready');
    expect(resolveConnection('http://127.0.0.1:3000', 'VITE_API_X', true).state).toBe('ready');
  });

  it('needs https for any other http origin', () => {
    expect(resolveConnection('http://sara.84-12-92-46.sslip.io', 'VITE_API_X', true)).toEqual({
      state: 'needs-https',
      apiBase: 'http://sara.84-12-92-46.sslip.io',
    });
  });

  it('is not-configured when the value is not a URL', () => {
    expect(resolveConnection('parcours.live', 'VITE_API_X', true)).toEqual(notConfigured);
  });

  it('is no-backend whatever the input when there is no backend', () => {
    expect(resolveConnection('https://x.test', 'VITE_API_X', false)).toEqual({ state: 'no-backend' });
    expect(resolveConnection(undefined, 'VITE_API_X', false)).toEqual({ state: 'no-backend' });
    expect(resolveConnection('', 'VITE_API_X', false)).toEqual({ state: 'no-backend' });
  });
});

describe('canSendToken', () => {
  it('allows https and http on localhost or 127.0.0.1', () => {
    expect(canSendToken(new URL('https://admin.x'))).toBe(true);
    expect(canSendToken(new URL('http://localhost:5174'))).toBe(true);
    expect(canSendToken(new URL('http://127.0.0.1:4173'))).toBe(true);
  });

  it('refuses http elsewhere', () => {
    expect(canSendToken(new URL('http://admin.interacti.84-12-92-46.sslip.io'))).toBe(false);
  });
});

describe('buildProducts', () => {
  const list = buildProducts({ VITE_API_STRIVE: 'https://strive.test' });
  const bySlug = (slug: string) => list.find((p) => p.slug === slug);

  it('lists the six products in order', () => {
    expect(list.map((p) => p.slug)).toEqual(['0nbox', 'strive', 'parcours', 'sara', 'fluid', 'harv3st']);
  });

  it('resolves each connection from its env var', () => {
    expect(bySlug('strive')?.connection).toEqual({ state: 'ready', apiBase: 'https://strive.test' });
    expect(bySlug('fluid')?.connection).toEqual({ state: 'not-configured', envVar: 'VITE_API_FLUID' });
    expect(bySlug('harv3st')?.connection).toEqual({ state: 'no-backend' });
  });

  it('marks Sara, Fluid and Harv3st coming soon and the rest live', () => {
    expect(list.map((p) => p.status)).toEqual([
      'live',
      'live',
      'live',
      'coming-soon',
      'coming-soon',
      'coming-soon',
    ]);
  });

  it('carries each product field', () => {
    expect(list.map((p) => p.field)).toEqual(['SaaS', 'SaaS', 'Edtech', 'AI', 'Crypto', 'Crypto']);
  });

  it('points the first four at their tile and leaves Fluid and Harv3st without one', () => {
    expect(list.map((p) => p.tile)).toEqual([
      '/brand/0nbox/tile.svg',
      '/brand/strive/tile.svg',
      '/brand/parcours/tile.svg',
      '/brand/sara/tile.svg',
      null,
      null,
    ]);
  });

  it('finds a product by slug', () => {
    expect(productBySlug('strive')?.name).toBe('Strive');
    expect(productBySlug('nope')).toBeUndefined();
  });
});
