import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { ProductConfig } from '@/config/products';
import {
  buildFormSchema,
  fieldErrorFrom,
  formFields,
  isCheckbox,
  isOptional,
  toFormValues,
  toPayload,
  type FormMode,
  type FormValues,
} from '@/forms/fields';
import { Button, Field, Modal, Notice } from '@/primitives';
import type { AdminRecord, AdminResourceMeta } from '@/types/admin';
import type { AdminApiError } from '@/utils';
import { FieldInput } from './field-input';
import { PickerContainerContext } from './relation-picker';

const EDIT_DESCRIPTION = 'Only the fields you change are sent.';
const NOTHING_TO_SAVE = 'Nothing to save.';
const LIST_HINT = 'One value per line.';

interface RecordFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductConfig;
  resource: AdminResourceMeta;
  /** Present when editing. */
  record?: AdminRecord;
  /** Gets the body to send: writable, changed fields only. */
  onSubmit: (payload: Record<string, unknown>) => void;
  isPending: boolean;
  /** The product's refusal. A message about a field goes under it; anything else to the notice. */
  error: AdminApiError | null;
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Create or edit any resource, as Sara's ServiceModal: the page owns the modal and the mutations
 * and remounts it (by key) per opening. Its only state is the form, built from the manifest. It
 * checks shape, then hands the payload up; it never calls the API itself.
 */
export function RecordFormModal({
  open,
  onOpenChange,
  product,
  resource,
  record,
  onSubmit,
  isPending,
  error,
  onCloseAutoFocus,
}: RecordFormModalProps) {
  const mode: FormMode = record ? 'update' : 'create';
  const noun = resource.singular.toLowerCase();
  const baseId = useId();

  const fields = useMemo(() => formFields(resource, mode), [resource, mode]);
  const names = useMemo(() => fields.map((field) => field.name), [fields]);
  const schema = useMemo(() => buildFormSchema(fields, mode), [fields, mode]);
  const defaultValues = useMemo(() => toFormValues(fields, record), [fields, record]);

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const {
    handleSubmit,
    setError,
    formState: { errors, dirtyFields },
  } = form;

  /** A message of the form's own, such as "Nothing to save.". */
  const [notice, setNotice] = useState<string | null>(null);
  /** The modal's content, where the relation picker's list portals to stay in the focus trap. */
  const [content, setContent] = useState<HTMLDivElement | null>(null);

  // A refusal about a field the form shows goes under that field.
  useEffect(() => {
    if (!error) return;
    const { field, message } = fieldErrorFrom(error, names);
    if (field) setError(field, { type: 'server', message }, { shouldFocus: true });
  }, [error, names, setError]);

  const failure = error ? fieldErrorFrom(error, names) : null;
  const formError = failure && failure.field === null ? failure.message : null;

  const save = handleSubmit((values) => {
    if (isPending) return;
    if (mode === 'update' && !fields.some((field) => dirtyFields[field.name])) {
      setNotice(NOTHING_TO_SAVE);
      return;
    }
    onSubmit(toPayload(fields, values, mode, dirtyFields));
  });

  const description = resource.note
    ? resource.note
    : mode === 'update'
      ? EDIT_DESCRIPTION
      : `Empty fields take ${product.name}'s default.`;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Portal>
        <Modal.Content
          ref={setContent}
          className="sm:max-w-[560px]"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <Modal.Handle />
          <Modal.Dismiss />
          <Modal.Title>{mode === 'update' ? `Edit ${noun}` : `New ${noun}`}</Modal.Title>
          <Modal.Description>{description}</Modal.Description>

          <PickerContainerContext.Provider value={content}>
            <FormProvider {...form}>
              <form
                noValidate
                autoComplete="off"
                onSubmit={(event) => {
                  setNotice(null);
                  void save(event);
                }}
                className="mt-6 grid gap-4"
              >
                {fields.map((field) => (
                  <Field
                    key={field.name}
                    id={`${baseId}-${field.name}`}
                    label={field.label}
                    // A checkbox is always true or false, so it is never "optional".
                    optional={!isCheckbox(field) && isOptional(field, mode)}
                    hint={field.list ? LIST_HINT : undefined}
                    error={errors[field.name]?.message}
                  >
                    <FieldInput field={field} product={product} record={record} />
                  </Field>
                ))}

                {notice ? (
                  <Notice>{notice}</Notice>
                ) : formError ? (
                  <Notice role="alert">{formError}</Notice>
                ) : null}

                <div className="mt-2 grid gap-2.5 sm:flex sm:flex-row-reverse">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? 'Saving…' : mode === 'update' ? 'Save changes' : `Create ${noun}`}
                  </Button>
                  <Modal.Close asChild>
                    <Button variant="secondary" disabled={isPending}>
                      Cancel
                    </Button>
                  </Modal.Close>
                </div>
              </form>
            </FormProvider>
          </PickerContainerContext.Provider>
        </Modal.Content>
      </Modal.Portal>
    </Modal>
  );
}
