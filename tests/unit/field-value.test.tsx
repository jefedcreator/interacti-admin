import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldValue } from '@/components/field-value';
import type { AdminFieldMeta } from '@/types/admin';

const field = (over: Partial<AdminFieldMeta> = {}): AdminFieldMeta => ({
  name: 'avatarUrl',
  label: 'Avatar url',
  type: 'string',
  list: false,
  required: false,
  nullable: true,
  readOnly: false,
  isId: false,
  enumValues: null,
  relation: null,
  ...over,
});

const URL = 'https://cdn.example.com/avatars/ada.png';

describe('FieldValue: an image url', () => {
  it('shows the image itself in the record view, with the url kept as text', () => {
    render(<FieldValue product="strive" field={field()} value={URL} full />);
    expect(screen.getByRole('img', { name: 'Avatar url' })).toHaveAttribute('src', URL);
    expect(screen.getByText(URL)).toBeInTheDocument();
  });

  it('falls back to the url as text when the image does not load', () => {
    render(<FieldValue product="strive" field={field()} value={URL} full />);
    fireEvent.error(screen.getByRole('img', { name: 'Avatar url' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(URL)).toBeInTheDocument();
  });

  it('leaves a table cell as text', () => {
    render(<FieldValue product="strive" field={field()} value={URL} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('never loads an http url, or a url in a non-string field', () => {
    const { rerender } = render(
      <FieldValue product="strive" field={field()} value="http://cdn.example.com/a.png" full />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<FieldValue product="strive" field={field({ type: 'text' })} value={URL} full />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
