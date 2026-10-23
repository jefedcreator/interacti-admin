import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { productBySlug } from '@/config/products';
import {
  Button,
  Field,
  Input,
  Modal,
  ProductMark,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/primitives';

describe('Field', () => {
  it('wires the label and the error to the control', () => {
    render(
      <Field id="name" label="Name" error="Required">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('id', 'name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'name-error');
    expect(document.getElementById('name-error')).toHaveTextContent('Required');
  });

  it('marks an optional field and describes it by its hint', () => {
    render(
      <Field id="bio" label="Bio" optional hint="Shown on the profile.">
        <Textarea />
      </Field>,
    );
    const textarea = screen.getByLabelText('Bio (optional)');
    expect(textarea).toHaveAttribute('aria-describedby', 'bio-hint');
    expect(textarea).not.toHaveAttribute('aria-invalid');
    expect(document.getElementById('bio-hint')).toHaveTextContent('Shown on the profile.');
  });
});

describe('Modal', () => {
  function renderModal(onOpenChange = vi.fn()) {
    render(
      <Modal open onOpenChange={onOpenChange}>
        <Modal.Portal>
          <Modal.Content>
            <Modal.Handle />
            <Modal.Dismiss />
            <Modal.Title>New club</Modal.Title>
            <Modal.Description>Empty fields take the default.</Modal.Description>
          </Modal.Content>
        </Modal.Portal>
      </Modal>,
    );
    return onOpenChange;
  }

  it('is a labelled, described dialog on the light surface', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'New club' });
    expect(dialog).toHaveAccessibleDescription('Empty fields take the default.');
    expect(dialog).toHaveClass('surface-light');
  });

  it('hides the handle from assistive tech', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'New club' });
    const handle = Array.from(dialog.querySelectorAll('[aria-hidden="true"]')).find((el) =>
      el.classList.contains('sm:hidden'),
    );
    expect(handle).toBeDefined();
  });

  it('closes from the Close button', async () => {
    const onOpenChange = renderModal();
    const dialog = screen.getByRole('dialog', { name: 'New club' });
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape', async () => {
    const onOpenChange = renderModal();
    await userEvent.setup().keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Button', () => {
  it('renders the child as the element with asChild', () => {
    render(
      <Button asChild>
        <a href="/x">Go</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/x');
  });
});

describe('Table', () => {
  it('gives a column header scope="col"', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody />
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('scope', 'col');
  });
});

describe('ProductMark', () => {
  it('shows the first letter when the product has no tile', () => {
    const fluid = productBySlug('fluid');
    if (!fluid) throw new Error('fluid is missing');
    render(<ProductMark product={fluid} />);
    expect(screen.getByText('F')).toBeInTheDocument();
  });

  it("shows the product's own tile as a decorative image", () => {
    const strive = productBySlug('strive');
    if (!strive) throw new Error('strive is missing');
    const { container } = render(<ProductMark product={strive} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/brand/strive/tile.svg');
    expect(img).toHaveAttribute('alt', '');
  });
});
