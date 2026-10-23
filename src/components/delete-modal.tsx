import { useId, useState } from 'react';
import { Button, Field, Input, Modal } from '@/primitives';
import type { AdminRecord, AdminResourceMeta } from '@/types/admin';
import type { AdminApiError } from '@/utils';

const DESCRIPTION = "This can't be undone. Records that belong to it may be deleted with it.";
const CONFIRM_WORD = 'delete';

interface DeleteModalProps {
  resource: AdminResourceMeta;
  record: AdminRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  /** The product's refusal, such as a 409. It replaces the description and the modal stays open. */
  error: AdminApiError | null;
}

/**
 * Asks before a record goes: type "delete", then confirm. Laid out as Sara's ConfirmModal and
 * presentational like it; the list page owns the mutation. No colour marks it as dangerous.
 */
export function DeleteModal({
  resource,
  record,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  error,
}: DeleteModalProps) {
  const fieldId = useId();
  const noun = resource.singular.toLowerCase();
  const recordKey = record?._key ?? null;

  const [typed, setTyped] = useState('');

  // Each time the modal opens, or opens for another record, the field starts empty.
  const [seen, setSeen] = useState({ open, recordKey });
  if (seen.open !== open || seen.recordKey !== recordKey) {
    setSeen({ open, recordKey });
    if (open) setTyped('');
  }

  const matched = typed.trim().toLowerCase() === CONFIRM_WORD;

  const confirm = (): void => {
    if (!matched || isPending) return;
    onConfirm();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Portal>
        <Modal.Content>
          <Modal.Handle />
          <Modal.Title>{`Delete ${record?._title ?? noun}?`}</Modal.Title>
          <Modal.Description>{error ? error.message : DESCRIPTION}</Modal.Description>
          <Field id={fieldId} label="Type delete to confirm" className="mt-5">
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  confirm();
                }
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <div className="mt-7 grid gap-2.5 sm:flex sm:flex-row-reverse">
            <Button disabled={!matched || isPending} onClick={confirm}>
              {isPending ? 'Deleting…' : `Delete ${noun}`}
            </Button>
            <Modal.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Modal.Close>
          </div>
        </Modal.Content>
      </Modal.Portal>
    </Modal>
  );
}
