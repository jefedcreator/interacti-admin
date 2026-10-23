import type {
  AdminFieldMeta,
  AdminManifest,
  AdminRecord,
  AdminResourceMeta,
} from '@/types/admin';

/** 40 characters, like the tokens the products issue. */
export const FAKE_TOKEN = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0';

const labelOf = (name: string): string => {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function field(
  name: string,
  type: AdminFieldMeta['type'],
  extra: Partial<AdminFieldMeta> = {},
): AdminFieldMeta {
  return {
    name,
    label: labelOf(name),
    type,
    list: false,
    required: false,
    nullable: false,
    readOnly: false,
    isId: false,
    enumValues: null,
    relation: null,
    ...extra,
  };
}

const idField = () => field('id', 'string', { isId: true, readOnly: true });
const createdAtField = () => field('createdAt', 'datetime', { readOnly: true });

function resources(): AdminResourceMeta[] {
  return [
    {
      key: 'users',
      label: 'Users',
      singular: 'User',
      model: 'User',
      group: 'People',
      titleField: 'email',
      columns: ['email', 'name', 'role', 'createdAt'],
      searchable: ['email', 'name'],
      sortable: ['email', 'name', 'role', 'createdAt'],
      filterable: ['role'],
      defaultSort: { by: 'createdAt', order: 'desc' },
      can: { create: true, update: true, delete: true },
      note: null,
      count: 0,
      fields: [
        idField(),
        field('email', 'string', { required: true }),
        field('name', 'string', { nullable: true }),
        field('role', 'enum', { enumValues: ['ADMIN', 'MEMBER'] }),
        createdAtField(),
      ],
      related: [
        { resource: 'clubs', field: 'ownerId' },
        { resource: 'sessions', field: 'userId' },
      ],
    },
    {
      key: 'clubs',
      label: 'Clubs',
      singular: 'Club',
      model: 'Club',
      group: 'Clubs',
      titleField: 'name',
      columns: ['name', 'ownerId', 'isPublic', 'memberCount', 'createdAt'],
      searchable: ['name'],
      sortable: ['name', 'ownerId', 'isPublic', 'memberCount', 'startsAt', 'createdAt'],
      filterable: ['ownerId', 'isPublic'],
      defaultSort: { by: 'createdAt', order: 'desc' },
      can: { create: true, update: true, delete: true },
      note: null,
      count: 0,
      fields: [
        idField(),
        field('name', 'string', { required: true }),
        field('description', 'text', { nullable: true }),
        field('ownerId', 'string', { required: true, relation: { resource: 'users' } }),
        field('isPublic', 'boolean'),
        field('memberCount', 'int', { readOnly: true }),
        field('settings', 'json', { nullable: true }),
        field('tags', 'string', { list: true }),
        field('startsAt', 'datetime', { nullable: true }),
        createdAtField(),
      ],
      related: [],
    },
    {
      key: 'sessions',
      label: 'Sessions',
      singular: 'Session',
      model: 'Session',
      group: 'Sign-in',
      titleField: 'userId',
      columns: ['userId', 'userAgent', 'createdAt'],
      searchable: ['userAgent'],
      sortable: ['userId', 'userAgent', 'createdAt'],
      filterable: ['userId'],
      defaultSort: { by: 'createdAt', order: 'desc' },
      can: { create: false, update: false, delete: true },
      note: null,
      count: 0,
      fields: [
        idField(),
        field('userId', 'string', { required: true, relation: { resource: 'users' } }),
        field('userAgent', 'string', { nullable: true }),
        createdAtField(),
      ],
      related: [],
    },
  ];
}

/** The manifest the fake serves. `count` is what the seed holds; the fake overrides it with live counts. */
export function fakeManifest(product: string): AdminManifest {
  const seeded = fakeRecords();
  return {
    product: product as AdminManifest['product'],
    resources: resources().map((resource) => ({
      ...resource,
      count: seeded[resource.key]?.length ?? 0,
    })),
  };
}

/**
 * Fills in `_title` and `_refs` on every record, in place. Run it again after any write, so
 * a renamed user is renamed in the sessions that point at it.
 */
export function decorate(
  metas: AdminResourceMeta[],
  records: Record<string, AdminRecord[]>,
): void {
  const keyed = metas.filter((meta) => records[meta.key]);

  // Titles that are the record's own value.
  for (const meta of keyed) {
    const titleMeta = meta.fields.find((f) => f.name === meta.titleField);
    for (const record of records[meta.key] ?? []) {
      const value = titleMeta?.relation ? '' : String(record[meta.titleField] ?? '');
      record._title = value || record._key;
    }
  }

  // References, which read the targets' titles.
  for (const meta of keyed) {
    for (const record of records[meta.key] ?? []) {
      const refs: AdminRecord['_refs'] = {};
      for (const f of meta.fields) {
        if (!f.relation) continue;
        const value = record[f.name];
        const target =
          value === null || value === undefined
            ? undefined
            : records[f.relation.resource]?.find((r) => r._key === value);
        refs[f.name] = target ? { key: target._key, title: target._title } : null;
      }
      record._refs = refs;
    }
  }

  // Titles that are a reference's title.
  for (const meta of keyed) {
    const titleMeta = meta.fields.find((f) => f.name === meta.titleField);
    if (!titleMeta?.relation) continue;
    for (const record of records[meta.key] ?? []) {
      record._title = record._refs[meta.titleField]?.title ?? record._key;
    }
  }
}

const DAY = 86_400_000;
const iso = (day: number): string => new Date(Date.UTC(2026, 0, 1) + day * DAY).toISOString();

function seed(key: string, values: Record<string, unknown>): AdminRecord {
  return { ...values, id: key, _key: key, _title: '', _refs: {} };
}

const USER_KEYS = ['user-ada', 'user-bola', 'user-chi'] as const;

/** Three users, 45 clubs and 2 sessions: 50 records. Newest first in the default sort. */
export function fakeRecords(): Record<string, AdminRecord[]> {
  const users = [
    seed(USER_KEYS[0], { email: 'ada@x.co', name: 'Ada', role: 'ADMIN', createdAt: iso(100) }),
    seed(USER_KEYS[1], { email: 'bola@x.co', name: 'Bola', role: 'MEMBER', createdAt: iso(99) }),
    seed(USER_KEYS[2], { email: 'chi@x.co', name: null, role: 'MEMBER', createdAt: iso(98) }),
  ];

  const clubs = [
    seed('club-01', {
      name: 'Lagos Runners',
      description: 'Saturday long runs along the lagoon.',
      ownerId: USER_KEYS[0],
      isPublic: true,
      memberCount: 3,
      settings: { theme: 'green' },
      tags: ['running', 'lagos'],
      startsAt: '2026-11-07T07:00:00.000Z',
      createdAt: iso(200),
    }),
    seed('club-02', {
      name: 'Abuja Pacers',
      description: null,
      ownerId: USER_KEYS[1],
      isPublic: false,
      memberCount: 1,
      settings: null,
      tags: [],
      startsAt: null,
      createdAt: iso(199),
    }),
  ];
  for (let n = 3; n <= 45; n += 1) {
    const padded = String(n).padStart(2, '0');
    clubs.push(
      seed(`club-${padded}`, {
        name: `Club ${padded}`,
        description: null,
        ownerId: USER_KEYS[n % 3],
        isPublic: n % 2 === 0,
        memberCount: 0,
        settings: null,
        tags: [],
        startsAt: null,
        createdAt: iso(201 - n),
      }),
    );
  }

  const sessions = [
    seed('session-1', {
      userId: USER_KEYS[0],
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      createdAt: iso(150),
    }),
    seed('session-2', {
      userId: USER_KEYS[1],
      userAgent: null,
      createdAt: iso(149),
    }),
  ];

  const records = { users, clubs, sessions };
  decorate(resources(), records);
  return records;
}
