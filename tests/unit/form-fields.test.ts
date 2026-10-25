import { describe, expect, it } from 'vitest';
import {
  buildFormSchema,
  fieldErrorFrom,
  formFields,
  isOptional,
  toFormValues,
  toPayload,
  type FormMode,
  type FormValues,
} from '@/forms/fields';
import type { AdminFieldMeta, AdminRecord, AdminResourceMeta } from '@/types/admin';
import { AdminApiError } from '@/utils';
import { fakeManifest, fakeRecords } from '../fake-api/fixture';

function pick<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} is missing from the fixture`);
  return value;
}

const resources = fakeManifest('strive').resources;
const resource = (key: string): AdminResourceMeta =>
  pick(
    resources.find((r) => r.key === key),
    key,
  );
const fieldOf = (meta: AdminResourceMeta, name: string): AdminFieldMeta =>
  pick(
    meta.fields.find((f) => f.name === name),
    `${meta.key}.${name}`,
  );

const clubs = resource('clubs');
const users = resource('users');

const records = fakeRecords();
const lagos: AdminRecord = pick(
  records.clubs?.find((r) => r._key === 'club-01'),
  'Lagos Runners',
);
const abuja: AdminRecord = pick(
  records.clubs?.find((r) => r._key === 'club-02'),
  'Abuja Pacers',
);
const ada: AdminRecord = pick(
  records.users?.find((r) => r.email === 'ada@x.co'),
  'ada',
);

/** A field the fixture doesn't have, for the types it leaves out. */
function meta(
  name: string,
  type: AdminFieldMeta['type'],
  extra: Partial<AdminFieldMeta> = {},
): AdminFieldMeta {
  return {
    name,
    label: name,
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

/** Each failing path with its message, or `{}` when the values pass. */
function problems(
  fields: AdminFieldMeta[],
  mode: FormMode,
  values: FormValues,
): Record<string, string> {
  const result = buildFormSchema(fields, mode).safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
  );
}

const createFields = formFields(clubs, 'create');
const updateFields = formFields(clubs, 'update');
const filled: FormValues = { ...toFormValues(createFields), name: 'Night Owls', ownerId: ada._key };

describe('formFields', () => {
  it('leaves out read-only fields and keeps manifest order', () => {
    expect(createFields.map((f) => f.name)).toEqual([
      'name',
      'description',
      'ownerId',
      'isPublic',
      'settings',
      'tags',
      'startsAt',
    ]);
  });

  it('never offers an id on update', () => {
    expect(formFields(users, 'update').map((f) => f.name)).not.toContain('id');
  });

  it('offers an id without a default on create only', () => {
    const handles: AdminResourceMeta = {
      ...users,
      fields: [meta('handle', 'string', { isId: true, required: true }), meta('reason', 'text')],
    };
    expect(formFields(handles, 'create').map((f) => f.name)).toEqual(['handle', 'reason']);
    expect(formFields(handles, 'update').map((f) => f.name)).toEqual(['reason']);
  });
});

describe('isOptional', () => {
  it('is "not required" on create', () => {
    expect(isOptional(fieldOf(clubs, 'description'), 'create')).toBe(true);
    expect(isOptional(fieldOf(clubs, 'name'), 'create')).toBe(false);
  });

  it('is "nullable" on update', () => {
    expect(isOptional(fieldOf(clubs, 'name'), 'update')).toBe(false);
    expect(isOptional(fieldOf(clubs, 'description'), 'update')).toBe(true);
  });
});

describe('buildFormSchema', () => {
  it('passes a filled create form', () => {
    expect(problems(createFields, 'create', filled)).toEqual({});
  });

  it('requires a field that is not optional', () => {
    expect(problems(createFields, 'create', { ...filled, name: '' })).toEqual({ name: 'Required' });
    expect(problems(createFields, 'create', { ...filled, name: '   ' })).toEqual({ name: 'Required' });
  });

  it('lets a nullable field be cleared on update, but not a required one', () => {
    const current = toFormValues(updateFields, lagos);
    expect(problems(updateFields, 'update', current)).toEqual({});
    expect(problems(updateFields, 'update', { ...current, description: '' })).toEqual({});
    expect(problems(updateFields, 'update', { ...current, name: '' })).toEqual({ name: 'Required' });
  });

  it('wants a whole number for an int', () => {
    const laps = [meta('laps', 'int')];
    expect(problems(laps, 'create', { laps: '1.5' })).toEqual({ laps: 'Enter a whole number' });
    expect(problems(laps, 'create', { laps: '-12' })).toEqual({});
  });

  it('wants a number for a float or a decimal', () => {
    const price = [meta('price', 'decimal')];
    expect(problems(price, 'create', { price: '12.50' })).toEqual({});
    expect(problems(price, 'create', { price: 'abc' })).toEqual({ price: 'Enter a number' });

    const pace = [meta('pace', 'float')];
    expect(problems(pace, 'create', { pace: '4.75' })).toEqual({});
    expect(problems(pace, 'create', { pace: '4,75' })).toEqual({ pace: 'Enter a number' });
  });

  it('wants valid JSON', () => {
    expect(problems(createFields, 'create', { ...filled, settings: '{' })).toEqual({
      settings: 'Enter valid JSON',
    });
  });

  it('wants a date', () => {
    expect(problems(createFields, 'create', { ...filled, startsAt: 'x' })).toEqual({
      startsAt: 'Enter a date',
    });
  });

  it('wants one of the enum values', () => {
    const fields = formFields(users, 'create');
    const values = { ...toFormValues(fields), email: 'dami@x.co' };
    expect(problems(fields, 'create', { ...values, role: 'OWNER' })).toEqual({
      role: 'Choose one of the options',
    });
    expect(problems(fields, 'create', { ...values, role: 'ADMIN' })).toEqual({});
  });

  it('checks each line of a list by its item type', () => {
    const laps = [meta('laps', 'int', { list: true })];
    expect(problems(laps, 'create', { laps: '3\n\n 4 ' })).toEqual({});
    expect(problems(laps, 'create', { laps: '3\n4.5' })).toEqual({ laps: 'Enter a whole number' });
  });

  it('lets a list be emptied on update', () => {
    const current = toFormValues(updateFields, lagos);
    expect(problems(updateFields, 'update', { ...current, tags: '' })).toEqual({});
  });
});

describe('toFormValues', () => {
  it('starts a create form empty, with booleans off', () => {
    expect(toFormValues(createFields)).toEqual({
      name: '',
      description: '',
      ownerId: '',
      isPublic: false,
      settings: '',
      tags: '',
      startsAt: '',
    });
  });

  it("turns a record's values into text, keeping booleans", () => {
    const values = toFormValues(updateFields, lagos);
    expect(values).toMatchObject({
      name: 'Lagos Runners',
      description: 'Saturday long runs along the lagoon.',
      ownerId: ada._key,
      isPublic: true,
      settings: JSON.stringify({ theme: 'green' }, null, 2),
      tags: 'running\nlagos',
    });
    expect(values.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('shows null and an empty list as an empty field', () => {
    expect(toFormValues(updateFields, abuja)).toMatchObject({
      description: '',
      isPublic: false,
      settings: '',
      tags: '',
      startsAt: '',
    });
  });

  it('round-trips a datetime through local time', () => {
    const values = toFormValues(updateFields, lagos);
    expect(toPayload(updateFields, values, 'update', { startsAt: true })).toEqual({
      startsAt: lagos.startsAt,
    });
  });
});

describe('toPayload', () => {
  it('sends the filled fields on create', () => {
    const values = { ...filled, isPublic: true };
    const expected = { name: 'Night Owls', ownerId: ada._key, isPublic: true };

    expect(toPayload(createFields, values, 'create', { name: true, ownerId: true, isPublic: true })).toEqual(
      expected,
    );
    // An empty field is left out, so the product's default applies.
    expect(
      toPayload(createFields, values, 'create', {
        name: true,
        description: true,
        ownerId: true,
        isPublic: true,
      }),
    ).toEqual(expected);
  });

  it('covers dirty fields only', () => {
    const current = toFormValues(updateFields, lagos);
    expect(toPayload(updateFields, { ...current, name: 'Elsewhere' }, 'update', {})).toEqual({});
    expect(toPayload(updateFields, { ...current, name: 'Elsewhere' }, 'update', { name: false })).toEqual(
      {},
    );
  });

  it('clears a field to null on update', () => {
    const current = toFormValues(updateFields, lagos);
    expect(
      toPayload(updateFields, { ...current, description: '' }, 'update', { description: true }),
    ).toEqual({ description: null });
  });

  it('parses JSON', () => {
    const current = toFormValues(updateFields, lagos);
    expect(
      toPayload(updateFields, { ...current, settings: '{"a":1}' }, 'update', { settings: true }),
    ).toEqual({ settings: { a: 1 } });
  });

  it('sends a list as its trimmed, non-empty lines', () => {
    const current = toFormValues(updateFields, lagos);
    expect(toPayload(updateFields, { ...current, tags: 'a\n\n b ' }, 'update', { tags: true })).toEqual({
      tags: ['a', 'b'],
    });
    // A scalar list is never nullable: emptied, it is an empty list.
    expect(toPayload(updateFields, { ...current, tags: '' }, 'update', { tags: true })).toEqual({
      tags: [],
    });
  });

  it('sends a datetime as ISO', () => {
    const current = toFormValues(updateFields, lagos);
    expect(
      toPayload(updateFields, { ...current, startsAt: '2026-10-22T14:32' }, 'update', { startsAt: true }),
    ).toEqual({ startsAt: new Date('2026-10-22T14:32').toISOString() });
  });

  it('sends ints and floats as numbers and decimals as strings', () => {
    const fields = [
      meta('laps', 'int'),
      meta('pace', 'float'),
      meta('price', 'decimal'),
      meta('splits', 'int', { list: true }),
    ];
    const values = { laps: '12', pace: '4.75', price: '12.50', splits: '1\n2' };
    const dirty = { laps: true, pace: true, price: true, splits: true };
    expect(toPayload(fields, values, 'create', dirty)).toEqual({
      laps: 12,
      pace: 4.75,
      price: '12.50',
      splits: [1, 2],
    });
  });
});

describe('fieldErrorFrom', () => {
  const names = ['name', 'description'];

  it("says a missing record doesn't exist any more", () => {
    expect(fieldErrorFrom(new AdminApiError('not-found', 'Not found', 404), names)).toEqual({
      field: null,
      message: "This record doesn't exist any more.",
    });
  });

  it('puts a message about a shown field on that field', () => {
    expect(
      fieldErrorFrom(new AdminApiError('invalid', 'name: Too short', 422, 'name'), names),
    ).toEqual({ field: 'name', message: 'Too short' });
    expect(
      fieldErrorFrom(new AdminApiError('conflict', 'name: already in use', 409, 'name'), names),
    ).toEqual({ field: 'name', message: 'already in use' });
  });

  it('keeps any other message whole, for the notice', () => {
    expect(
      fieldErrorFrom(
        new AdminApiError('invalid', 'memberCount: Unrecognized key', 422, 'memberCount'),
        names,
      ),
    ).toEqual({ field: null, message: 'memberCount: Unrecognized key' });
    expect(fieldErrorFrom(new AdminApiError('invalid', 'Expected object', 422), names)).toEqual({
      field: null,
      message: 'Expected object',
    });
  });
});
