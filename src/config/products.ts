export type ProductSlug = '0nbox' | 'strive' | 'parcours' | 'sara' | 'fluid' | 'harv3st';

export type Connection =
  | { state: 'ready'; apiBase: string }
  | { state: 'needs-https'; apiBase: string }
  | { state: 'not-configured'; envVar: string }
  | { state: 'no-backend' };

export type ProductConfig = {
  slug: ProductSlug;
  name: string;
  field: 'SaaS' | 'Edtech' | 'AI' | 'Crypto';
  status: 'live' | 'coming-soon';
  tile: string | null;
  connection: Connection;
};

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

/** The token may travel over https, or over http to a loopback host in development. */
export function canSendToken(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

export function resolveConnection(
  raw: string | undefined,
  envVar: string,
  hasBackend: boolean,
): Connection {
  if (!hasBackend) return { state: 'no-backend' };

  const value = raw?.trim() ?? '';
  const notConfigured: Connection = { state: 'not-configured', envVar };
  if (!value) return notConfigured;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return notConfigured;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return notConfigured;

  const apiBase = value.replace(/\/+$/, '');
  return canSendToken(url) ? { state: 'ready', apiBase } : { state: 'needs-https', apiBase };
}

type Definition = Omit<ProductConfig, 'connection'> & { envVar: string; hasBackend: boolean };

const definitions: Definition[] = [
  { slug: '0nbox', name: '0nbox', field: 'SaaS', status: 'live', tile: '/brand/0nbox/tile.svg', envVar: 'VITE_API_0NBOX', hasBackend: true },
  { slug: 'strive', name: 'Strive', field: 'SaaS', status: 'live', tile: '/brand/strive/tile.svg', envVar: 'VITE_API_STRIVE', hasBackend: true },
  { slug: 'parcours', name: 'Parcours', field: 'Edtech', status: 'live', tile: '/brand/parcours/tile.svg', envVar: 'VITE_API_PARCOURS', hasBackend: true },
  { slug: 'sara', name: 'Sara', field: 'AI', status: 'coming-soon', tile: '/brand/sara/tile.svg', envVar: 'VITE_API_SARA', hasBackend: true },
  { slug: 'fluid', name: 'Fluid', field: 'Crypto', status: 'coming-soon', tile: null, envVar: 'VITE_API_FLUID', hasBackend: true },
  { slug: 'harv3st', name: 'Harv3st', field: 'Crypto', status: 'coming-soon', tile: null, envVar: 'VITE_API_HARV3ST', hasBackend: false },
];

export function buildProducts(env: Record<string, string | undefined>): ProductConfig[] {
  return definitions.map(({ envVar, hasBackend, ...product }) => ({
    ...product,
    connection: resolveConnection(env[envVar], envVar, hasBackend),
  }));
}

export const products: ProductConfig[] = buildProducts(import.meta.env);

export function productBySlug(slug: string): ProductConfig | undefined {
  return products.find((p) => p.slug === slug);
}
