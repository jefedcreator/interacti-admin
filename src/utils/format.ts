import type { ProductConfig } from '@/config/products';
import type { AdminFieldMeta, AdminManifest, AdminResourceMeta } from '@/types/admin';
import type { AdminApiError } from './axios';

const counts = new Intl.NumberFormat('en-GB');

/** 2340 reads "2,340". */
export function formatCount(n: number): string {
  return counts.format(n);
}

/** The reader's own locale and time zone. */
const dateTimes = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** What stands in for a missing value. */
export const NO_VALUE = '—';

/**
 * A field's name beside its value. A reference shows the record it points at, so it drops the key
 * suffix the manifest's label carries: "Owner id" reads "Owner".
 */
export function displayLabel(field: AdminFieldMeta): string {
  return field.relation ? field.label.replace(/ id$/i, '') : field.label;
}

function formatOne(field: AdminFieldMeta, value: unknown): string {
  if (value === null || value === undefined) return NO_VALUE;
  switch (field.type) {
    case 'datetime': {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : dateTimes.format(date);
    }
    case 'boolean':
      return value === true ? 'Yes' : value === false ? 'No' : String(value);
    case 'json':
      return JSON.stringify(value);
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

/**
 * One value as a line of text: a date and time in the reader's locale, a boolean as Yes or No,
 * JSON compact, a list joined with commas, and nothing as "—".
 */
export function formatValue(field: AdminFieldMeta, value: unknown): string {
  if (value === null || value === undefined) return NO_VALUE;
  if (field.list && Array.isArray(value)) {
    return value.map((item: unknown) => formatOne(field, item)).join(', ');
  }
  return formatOne(field, value);
}

const plural = (n: number, one: string, many: string): string =>
  `${formatCount(n)} ${n === 1 ? one : many}`;

/**
 * The one line a product's connection comes to, for its card and its page. A product that can't be
 * asked says why; one that can reads from the manifest query, in the order checking, error, loaded.
 */
export function describeConnection(
  product: ProductConfig,
  manifest: { data?: AdminManifest; error: AdminApiError | null; isLoading: boolean },
): string {
  switch (product.connection.state) {
    case 'no-backend':
      return 'No backend yet';
    case 'not-configured':
      return 'Not connected';
    case 'needs-https':
      return 'Needs HTTPS';
    case 'ready':
      break;
  }

  if (manifest.isLoading) return 'Checking…';

  if (manifest.error) {
    switch (manifest.error.kind) {
      case 'unauthorized':
        return 'Token rejected';
      case 'off':
        return 'Admin is off';
      default:
        return "Couldn't reach it";
    }
  }

  if (manifest.data) {
    const { resources } = manifest.data;
    const records = resources.reduce((sum, resource) => sum + resource.count, 0);
    return `${plural(resources.length, 'resource', 'resources')} · ${plural(records, 'record', 'records')}`;
  }

  return 'Checking…';
}

/**
 * What the owner does about a connection that isn't working, or null when there is nothing to do
 * (or nothing known). `off` is the manifest's verdict, so it needs the error as well.
 */
export function fixFor(product: ProductConfig, error?: AdminApiError | null): string | null {
  const { connection } = product;

  if (connection.state === 'not-configured') return `Set ${connection.envVar} and rebuild.`;
  if (connection.state === 'needs-https') {
    return `Use an https address for VITE_API_${product.slug.toUpperCase()}.`;
  }
  if (connection.state === 'ready' && error?.kind === 'off') {
    return 'Set ADMIN_API_TOKEN on the server and restart it.';
  }
  return null;
}

/** Resources under their group headings, groups in the order they first appear. */
export function groupResources(
  resources: AdminResourceMeta[],
): { group: string; resources: AdminResourceMeta[] }[] {
  const groups: { group: string; resources: AdminResourceMeta[] }[] = [];
  for (const resource of resources) {
    const found = groups.find((g) => g.group === resource.group);
    if (found) found.resources.push(resource);
    else groups.push({ group: resource.group, resources: [resource] });
  }
  return groups;
}
