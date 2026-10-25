import { useId, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Button, Field, Input } from '@/primitives';
import type { AdminResourceMeta, ListParams } from '@/types/admin';
import { FilterMenu } from './filter-menu';

const SEARCH_DELAY = 500;
/** The contract's longest `query` (spec §6.5). */
const QUERY_LIMIT = 255;

export const CLEAR_LABEL = 'Clear search and filters';

interface TableToolbarProps {
  resource: AdminResourceMeta;
  params: ListParams;
  onSearch(value: string): void;
  onFilter(field: string, value: string | null): void;
  onClear(): void;
  /** Opens the create modal, or null when the resource can't be created here. */
  onCreate: (() => void) | null;
}

/**
 * Above the table, as in Dandys: the search on the left, sent 500ms after typing stops; the filter
 * menu next to it; and on the right "New <singular>", where the resource allows it.
 */
export function TableToolbar({
  resource,
  params,
  onSearch,
  onFilter,
  onClear,
  onCreate,
}: TableToolbarProps) {
  const searchId = useId();
  const query = params.query ?? '';

  const [text, setText] = useState(query);
  // The URL can change under the field (a reset, Back). Follow it, unless it is what was typed,
  // so a trailing space survives the round trip.
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    if (text.trim() !== query) setText(query);
  }

  const search = useDebounce((value: string) => onSearch(value.trim()), SEARCH_DELAY);
  const filtered = query !== '' || Object.keys(params.filters).length > 0;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        role="search"
        noValidate
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(text.trim());
        }}
        className="w-full sm:w-80"
      >
        <Field id={searchId} label={`Search ${resource.label.toLowerCase()}`}>
          <Input
            type="search"
            value={text}
            maxLength={QUERY_LIMIT}
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value);
              search(event.target.value);
            }}
          />
        </Field>
      </form>

      <FilterMenu resource={resource} filters={params.filters} onFilter={onFilter} />

      {filtered ? (
        <Button variant="ghost" onClick={onClear}>
          {CLEAR_LABEL}
        </Button>
      ) : null}

      {onCreate ? (
        <Button data-new-record className="sm:ml-auto" onClick={onCreate}>
          {`New ${resource.singular.toLowerCase()}`}
        </Button>
      ) : null}
    </div>
  );
}
