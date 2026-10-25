import { useId } from 'react';
import {
  Button,
  Field,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
} from '@/primitives';
import type { AdminFieldMeta, AdminResourceMeta } from '@/types/admin';
import { displayLabel } from '@/utils';

const ANY = 'Any';

/** A field the menu can offer as a choice: an enum's values, or Yes and No. */
function choicesOf(field: AdminFieldMeta): { value: string; label: string }[] | null {
  if (field.list) return null;
  if (field.type === 'boolean') {
    return [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ];
  }
  if (field.type === 'enum' && field.enumValues?.length) {
    return field.enumValues.map((value) => ({ value, label: value }));
  }
  return null;
}

interface FilterMenuProps {
  resource: AdminResourceMeta;
  /** The filters the table has now, by field name. */
  filters: Record<string, string>;
  onFilter(field: string, value: string | null): void;
}

/**
 * Dandys' filter menu, as a popover over the toolbar: each enum offers its values and each boolean
 * Yes and No. A reference can't be chosen from a list here; when one arrives in the URL (from a
 * record's "Related" link) it shows as a chip that removes it.
 */
export function FilterMenu({ resource, filters, onFilter }: FilterMenuProps) {
  const baseId = useId();

  const fields = resource.filterable.flatMap((name) => {
    const field = resource.fields.find((f) => f.name === name);
    return field ? [field] : [];
  });
  const choosable = fields.flatMap((field) => {
    const choices = choicesOf(field);
    return choices ? [{ field, choices }] : [];
  });
  const chips = fields.filter((field) => !choicesOf(field) && filters[field.name] !== undefined);
  const chosen = choosable.filter(({ field }) => filters[field.name] !== undefined).length;

  return (
    <>
      {choosable.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary">{chosen > 0 ? `Filter · ${chosen}` : 'Filter'}</Button>
          </PopoverTrigger>
          <PopoverContent aria-label="Filters" align="start" className="grid gap-4">
            {choosable.map(({ field, choices }) => (
              <Field key={field.name} id={`${baseId}-${field.name}`} label={field.label}>
                <Select
                  value={filters[field.name] ?? ''}
                  onChange={(event) => onFilter(field.name, event.target.value || null)}
                >
                  <option value="">{ANY}</option>
                  {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}

      {chips.map((field) => {
        const text = `${displayLabel(field)}: ${filters[field.name] ?? ''}`;
        return (
          <button
            key={field.name}
            type="button"
            aria-label={`Remove filter ${text}`}
            onClick={() => onFilter(field.name, null)}
            className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full border border-ink/30 px-4 text-micro transition-colors duration-300 hover:border-ink"
          >
            <span className="min-w-0 truncate">{text}</span>
            <span aria-hidden="true">×</span>
          </button>
        );
      })}
    </>
  );
}
