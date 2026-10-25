import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { ProductSlug } from '@/config/products';
import { useRecordsQuery } from '@/hooks/queries/use-records';
import { useDebounce } from '@/hooks/use-debounce';
import { Input, Popover, PopoverAnchor, PopoverContent, useFieldContext } from '@/primitives';
import type { AdminRecord } from '@/types/admin';
import { cn } from '@/utils';

const SEARCH_DELAY = 300;
const PAGE_SIZE = 10;
/** The contract's longest `query` (spec §6.5). */
const QUERY_LIMIT = 255;

const SEARCHING = 'Searching…';
const NO_MATCHES = 'No matches.';

/**
 * The element the picker's list portals into. The form modal provides its own content, so the
 * list renders inside the dialog's focus trap and scroll lock rather than on the body.
 */
export const PickerContainerContext = createContext<HTMLElement | null>(null);

interface RelationPickerProps {
  product: ProductSlug;
  /** The resource the foreign key points at. */
  target: string;
  /** The key the form holds now. */
  value: string;
  /** The title of the record `value` points at, when the record already has one. */
  initialTitle?: string;
  onChange: (key: string) => void;
}

/**
 * A foreign key as a combobox (spec §8.4.2): typing searches the target resource and lists titles,
 * each with its key; Enter or a click chooses one and the form gets its key. A key pasted or typed
 * by hand is kept as typed when the field is left. Its id, description and invalid state come from
 * the `Field` around it, through `Input`.
 */
export const RelationPicker = forwardRef<HTMLInputElement, RelationPickerProps>(
  ({ product, target, value, initialTitle, onChange }, ref) => {
    const field = useFieldContext();
    const container = useContext(PickerContainerContext);
    const ownId = useId();
    const listboxId = `${field?.id ?? ownId}-listbox`;
    const optionId = (index: number): string => `${listboxId}-${index}`;

    /** What the input shows: the chosen record's title, or what was typed. */
    const [text, setText] = useState(() => initialTitle ?? value);
    /** The record the form's key belongs to, so its title can stand in for the key. */
    const [chosen, setChosen] = useState<{ key: string; title: string } | null>(() =>
      value ? { key: value, title: initialTitle ?? value } : null,
    );
    /** Typed since the last choice: leaving the field keeps the text as a key. */
    const [edited, setEdited] = useState(false);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const search = useDebounce(setQuery, SEARCH_DELAY);
    const results = useRecordsQuery(
      product,
      target,
      { page: 1, size: PAGE_SIZE, query, filters: {} },
      { enabled: open },
    );
    const options: AdminRecord[] = results.data?.data ?? [];
    const activeIndex = options.findIndex((option) => option._key === activeKey);

    let message: string | null = null;
    if (results.isError) message = results.error.message;
    else if (!results.data) message = SEARCHING;
    else if (options.length === 0) message = NO_MATCHES;

    const inputRef = useRef<HTMLInputElement | null>(null);
    const setInput = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const close = (): void => {
      setOpen(false);
      setActiveKey(null);
    };

    const choose = (record: AdminRecord): void => {
      setChosen({ key: record._key, title: record._title });
      setText(record._title);
      setEdited(false);
      close();
      onChange(record._key);
    };

    /** Keeps what was typed as the key, unless it is the chosen record's title again. */
    const commit = (): void => {
      if (!edited) return;
      setEdited(false);
      const typed = text.trim();
      if (chosen && typed === chosen.title) {
        setText(chosen.title);
        return;
      }
      setText(typed);
      setChosen(typed ? { key: typed, title: typed } : null);
      onChange(typed);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          if (options.length === 0) return;
          const step = event.key === 'ArrowDown' ? 1 : -1;
          const from = activeIndex === -1 ? (step === 1 ? -1 : options.length) : activeIndex;
          const next = (from + step + options.length) % options.length;
          setActiveKey(options[next]?._key ?? null);
          return;
        }
        case 'Enter': {
          const option = open && activeIndex !== -1 ? options[activeIndex] : undefined;
          if (option) {
            // Choosing an option must not submit the form.
            event.preventDefault();
            choose(option);
            return;
          }
          // Nothing highlighted: the typed key goes with the form's own submit.
          commit();
          close();
          return;
        }
        default:
          // Escape is Radix's: the list is the topmost layer, so it closes and the modal stays.
          return;
      }
    };

    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true);
          else close();
        }}
      >
        <PopoverAnchor asChild>
          <Input
            ref={setInput}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={open && activeIndex !== -1 ? optionId(activeIndex) : undefined}
            value={text}
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              setEdited(true);
              setOpen(true);
              setActiveKey(null);
              search(next.trim().slice(0, QUERY_LIMIT));
            }}
            onKeyDown={onKeyDown}
            onBlur={() => {
              commit();
              close();
            }}
            autoCapitalize="none"
            spellCheck={false}
          />
        </PopoverAnchor>
        <PopoverContent
          container={container}
          // Radix makes popover content a dialog. Here it only frames the listbox, so no role.
          role={undefined}
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-1.5"
          // Focus stays in the input the whole time; the active option is aria-activedescendant.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            // Pressing in the input is typing, not leaving.
            if (event.target instanceof Node && inputRef.current?.contains(event.target)) {
              event.preventDefault();
            }
          }}
        >
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={field?.labelId}
            aria-busy={results.isFetching || undefined}
            className="grid max-h-72 overflow-y-auto"
          >
            {options.map((record, index) => {
              const id = optionId(index);
              const active = index === activeIndex;
              return (
                <div
                  key={record._key}
                  id={id}
                  role="option"
                  aria-selected={active}
                  aria-labelledby={`${id}-title`}
                  aria-describedby={`${id}-key`}
                  onClick={() => choose(record)}
                  onMouseMove={() => {
                    if (!active) setActiveKey(record._key);
                  }}
                  className={cn(
                    'grid cursor-pointer gap-0.5 rounded-[calc(var(--radius-control)-0.375rem)] px-2.5 py-2',
                    active && 'bg-ink/10',
                  )}
                >
                  <span id={`${id}-title`} className="truncate">
                    {record._title}
                  </span>
                  <span id={`${id}-key`} className="truncate text-micro text-ink/80">
                    {record._key}
                  </span>
                </div>
              );
            })}
          </div>
          {message ? (
            <p role="status" className="px-2.5 py-2 text-micro text-ink/80">
              {message}
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    );
  },
);
RelationPicker.displayName = 'RelationPicker';
