import { z } from 'zod';
import type { AdminFieldMeta, AdminRecord, AdminResourceMeta } from '@/types/admin';
import type { AdminApiError } from '@/utils';

/*
 * The create and edit form, as data. Every control holds a string, except a checkbox, which holds a
 * boolean. These functions turn a record into those values, check their shape (spec §8.4.2: the
 * product's own 422 or 409 is the authority), and turn the changed ones back into a payload.
 */

export type FormValue = string | boolean;
export type FormValues = Record<string, FormValue>;
export type FormMode = 'create' | 'update';

export const NOT_FOUND_MESSAGE = "This record doesn't exist any more.";

const WHOLE_NUMBER = /^-?\d+$/;
const NUMBER = /^-?\d+(\.\d+)?$/;

/** A single boolean is a checkbox. A list of booleans is a textarea like any other list. */
export function isCheckbox(field: AdminFieldMeta): boolean {
  return field.type === 'boolean' && !field.list;
}

/** The fields a form offers: not read-only, and on update not an id. In manifest order. */
export function formFields(resource: AdminResourceMeta, mode: FormMode): AdminFieldMeta[] {
  return resource.fields.filter((field) => !field.readOnly && !(mode === 'update' && field.isId));
}

/** May be left empty: not required on create, nullable on update. */
export function isOptional(field: AdminFieldMeta, mode: FormMode): boolean {
  return mode === 'create' ? !field.required : field.nullable;
}

/** A list's values: one per line, trimmed, blank lines dropped. */
function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** What's wrong with one trimmed, non-empty value of the field's type, or null. */
function itemProblem(field: AdminFieldMeta, text: string): string | null {
  switch (field.type) {
    case 'int':
      return WHOLE_NUMBER.test(text) ? null : 'Enter a whole number';
    case 'float':
    case 'decimal':
      return NUMBER.test(text) ? null : 'Enter a number';
    case 'datetime':
      return Number.isNaN(new Date(text).getTime()) ? 'Enter a date' : null;
    case 'json':
      try {
        JSON.parse(text);
        return null;
      } catch {
        return 'Enter valid JSON';
      }
    case 'enum':
      return field.enumValues?.includes(text) ? null : 'Choose one of the options';
    case 'boolean':
      // Only reached for a list of booleans; a single one is a checkbox.
      return text === 'true' || text === 'false' ? null : 'Enter true or false';
    case 'string':
    case 'text':
      return null;
  }
}

function problemOf(field: AdminFieldMeta, value: string, mode: FormMode): string | null {
  if (field.list) {
    const items = linesOf(value);
    // A scalar list is never nullable, but it can be emptied: on update an empty list is a value.
    if (items.length === 0) return mode === 'create' && field.required ? 'Required' : null;
    for (const item of items) {
      const problem = itemProblem(field, item);
      if (problem) return problem;
    }
    return null;
  }

  const text = value.trim();
  if (text === '') return isOptional(field, mode) ? null : 'Required';
  return itemProblem(field, text);
}

/** Zod 4, over the form's strings and booleans. It checks shape only. */
export function buildFormSchema(
  fields: AdminFieldMeta[],
  mode: FormMode,
): z.ZodObject<Record<string, z.ZodString | z.ZodBoolean>> {
  const shape: Record<string, z.ZodString | z.ZodBoolean> = {};
  for (const field of fields) {
    shape[field.name] = isCheckbox(field)
      ? z.boolean()
      : z.string().superRefine((value, ctx) => {
          const message = problemOf(field, value, mode);
          if (message) ctx.addIssue({ code: 'custom', message });
        });
  }
  return z.object(shape);
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** An instant as a `datetime-local` value, `YYYY-MM-DDTHH:mm`, in the browser's time zone. */
function toLocalInput(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** One stored value as the text a control shows. A list item's JSON stays on one line. */
function textOf(field: AdminFieldMeta, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (field.type === 'datetime') return toLocalInput(value);
  if (field.type === 'json') return field.list ? JSON.stringify(value) : JSON.stringify(value, null, 2);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** A record's values as the form holds them, or an empty form when there is no record. */
export function toFormValues(fields: AdminFieldMeta[], record?: AdminRecord): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    const raw: unknown = record?.[field.name];
    if (isCheckbox(field)) {
      values[field.name] = typeof raw === 'boolean' ? raw : false;
    } else if (field.list) {
      values[field.name] = Array.isArray(raw)
        ? raw.map((item: unknown) => textOf(field, item)).join('\n')
        : textOf(field, raw);
    } else {
      values[field.name] = textOf(field, raw);
    }
  }
  return values;
}

/** One checked, non-empty value as the wire type spec §6.4 asks for. */
function toWire(field: AdminFieldMeta, text: string): unknown {
  switch (field.type) {
    case 'int':
      return Number.parseInt(text, 10);
    case 'float':
      return Number(text);
    case 'datetime':
      return new Date(text).toISOString();
    case 'json':
      return JSON.parse(text) as unknown;
    case 'boolean':
      return text === 'true';
    case 'decimal':
    case 'enum':
    case 'string':
    case 'text':
      return text;
  }
}

/**
 * The body to send: the dirty fields only. An empty field is left out on create, so the product's
 * default applies, and is `null` on update. An emptied list is `[]`, since a list is never null.
 * A checkbox always shows true or false, so on create its value is always sent: what is shown is
 * what is saved, whatever the product's default is.
 */
export function toPayload(
  fields: AdminFieldMeta[],
  values: FormValues,
  mode: FormMode,
  dirty: Partial<Record<string, boolean>>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const value = values[field.name];
    if (value === undefined) continue;
    const shown = mode === 'create' && typeof value === 'boolean';
    if (!shown && !dirty[field.name]) continue;

    if (typeof value === 'boolean') {
      payload[field.name] = value;
      continue;
    }

    if (field.list) {
      const items = linesOf(value);
      if (items.length === 0 && mode === 'create') continue;
      payload[field.name] = items.map((item) => toWire(field, item));
      continue;
    }

    if (value.trim() === '') {
      if (mode === 'update') payload[field.name] = null;
      continue;
    }

    // What someone writes in a text field is sent as written; everything else is trimmed.
    const text = field.type === 'string' || field.type === 'text' ? value : value.trim();
    payload[field.name] = toWire(field, text);
  }

  return payload;
}

/**
 * Where a failed save's message goes. A `path: message` about a field the form shows goes under
 * that field, without its path. A missing record says so. Anything else goes to the notice whole.
 */
export function fieldErrorFrom(
  error: AdminApiError,
  names: string[],
): { field: string | null; message: string } {
  if (error.field && names.includes(error.field)) {
    const at = error.message.indexOf(': ');
    return { field: error.field, message: at === -1 ? error.message : error.message.slice(at + 2) };
  }
  if (error.kind === 'not-found') return { field: null, message: NOT_FOUND_MESSAGE };
  return { field: null, message: error.message };
}
