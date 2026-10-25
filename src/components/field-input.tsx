import { useController, useFormContext } from 'react-hook-form';
import type { ProductConfig } from '@/config/products';
import { isCheckbox, isOptional, type FormMode, type FormValues } from '@/forms/fields';
import { Checkbox, Input, Select, Textarea } from '@/primitives';
import type { AdminFieldMeta, AdminRecord } from '@/types/admin';
import { RelationPicker } from './relation-picker';

interface FieldInputProps {
  field: AdminFieldMeta;
  product: ProductConfig;
  /** Present when editing. */
  record?: AdminRecord;
}

/**
 * One manifest field's control, per spec §8.4.2's table, registered with the form around it. It
 * sits in a `Field`, which gives it its id, description and invalid state. Every value is text
 * except a checkbox's; `forms/fields` turns the text into the wire type on submit.
 */
export function FieldInput({ field, product, record }: FieldInputProps) {
  const { register } = useFormContext<FormValues>();

  if (isCheckbox(field)) return <CheckboxControl name={field.name} />;

  // A scalar list, foreign keys included: one value per line.
  if (field.list) return <Textarea spellCheck={false} {...register(field.name)} />;

  if (field.relation) {
    return (
      <RelationControl
        name={field.name}
        product={product}
        target={field.relation.resource}
        initialTitle={record?._refs[field.name]?.title}
      />
    );
  }

  switch (field.type) {
    case 'text':
      return <Textarea {...register(field.name)} />;
    case 'json':
      return <Textarea spellCheck={false} {...register(field.name)} />;
    case 'enum':
      return <EnumControl field={field} record={record} />;
    case 'datetime':
      return <Input type="datetime-local" {...register(field.name)} />;
    case 'int':
      return <Input inputMode="numeric" {...register(field.name)} />;
    case 'float':
    case 'decimal':
      return <Input inputMode="decimal" {...register(field.name)} />;
    case 'boolean':
    case 'string':
      return <Input {...register(field.name)} />;
  }
}

function CheckboxControl({ name }: { name: string }) {
  const { control } = useFormContext<FormValues>();
  const { field } = useController({ name, control });

  return (
    <Checkbox
      ref={field.ref}
      name={field.name}
      checked={field.value === true}
      onChange={(event) => field.onChange(event.target.checked)}
      onBlur={field.onBlur}
    />
  );
}

function RelationControl({
  name,
  product,
  target,
  initialTitle,
}: {
  name: string;
  product: ProductConfig;
  target: string;
  initialTitle?: string;
}) {
  const { control } = useFormContext<FormValues>();
  const { field } = useController({ name, control });

  return (
    <RelationPicker
      ref={field.ref}
      product={product.slug}
      target={target}
      value={typeof field.value === 'string' ? field.value : ''}
      initialTitle={initialTitle}
      onChange={field.onChange}
    />
  );
}

/**
 * A native select of the enum's values. It offers an empty choice whenever the field may be left
 * empty, or starts empty: "None" for a nullable field, a blank line otherwise.
 */
function EnumControl({ field, record }: { field: AdminFieldMeta; record?: AdminRecord }) {
  const { register } = useFormContext<FormValues>();
  const mode: FormMode = record ? 'update' : 'create';
  const stored = record?.[field.name];
  const startsEmpty = stored === undefined || stored === null || stored === '';

  return (
    <Select {...register(field.name)}>
      {isOptional(field, mode) || startsEmpty ? (
        <option value="">{field.nullable ? 'None' : ''}</option>
      ) : null}
      {(field.enumValues ?? []).map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </Select>
  );
}
