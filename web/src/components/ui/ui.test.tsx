import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/i18n';
import { useState } from 'react';
import { Button, ConfirmDialog, DataTable, Modal, SearchInput, StatCard, Tabs, type Column } from '.';

interface Row {
  id: number;
  name: string;
}
const cols: Column<Row>[] = [{ key: 'name', header: 'Name', cell: (r) => r.name, sortValue: (r) => r.name }];
const rows: Row[] = [
  { id: 1, name: 'b' },
  { id: 2, name: 'c' },
  { id: 3, name: 'a' },
];
const names = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.textContent);

describe('DataTable', () => {
  it('sorts asc → desc → unsorted when the header is clicked', async () => {
    render(<DataTable columns={cols} rows={rows} rowKey={(r) => r.id} />);
    const header = screen.getByRole('button', { name: 'Name' });
    await userEvent.click(header);
    expect(names()).toEqual(['a', 'b', 'c']);
    await userEvent.click(header);
    expect(names()).toEqual(['c', 'b', 'a']);
    await userEvent.click(header);
    expect(names()).toEqual(['b', 'c', 'a']);
  });

  it('pages client-side and shows the empty state', async () => {
    const { rerender } = render(<DataTable columns={cols} rows={rows} rowKey={(r) => r.id} pageSize={2} />);
    expect(names()).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /التالي|Next/ }));
    expect(names()).toHaveLength(1);
    rerender(<DataTable columns={cols} rows={[]} rowKey={(r) => r.id} emptyTitle="nothing here" />);
    expect(screen.getByText('nothing here')).toBeInTheDocument();
  });
});

describe('Modal / ConfirmDialog / Button', () => {
  it('closes on Escape and exposes an accessible dialog', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        body
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'T' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('ConfirmDialog calls confirm and disables its buttons while loading', async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        title="Del"
        message="sure?"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /تأكيد|Confirm/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    rerender(
      <ConfirmDialog
        open
        title="Del"
        message="sure?"
        loading
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /إلغاء|Cancel/ })).toBeDisabled();
  });

  it('Button in loading state is disabled and does not fire onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        go
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('SearchInput', () => {
  function Harness({ debounceMs }: { debounceMs: number }) {
    const [q, setQ] = useState('');
    return <SearchInput value={q} onChange={setQ} debounceMs={debounceMs} placeholder="find" />;
  }
  it('debounceMs 0 keeps fast typing intact (no dropped letters)', async () => {
    const user = userEvent.setup();
    render(<Harness debounceMs={0} />);
    await user.type(screen.getByRole('searchbox'), 'Painter');
    expect(screen.getByRole('searchbox')).toHaveValue('Painter');
  });
});

describe('StatCard', () => {
  it('shows label and value', () => {
    render(
      <StatCard
        label="Users"
        value="1,204"
        icon={<i />}
        chipClassName="bg-sky-500"
        tileClassName="bg-sky-50"
      />,
    );
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('1,204')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('marks the active tab, links tab and panel ids, and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        value="a"
        onChange={onChange}
        label="demo"
        idPrefix="demo"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Alpha', selected: true })).toHaveAttribute(
      'aria-controls',
      'demo-tabpanel-a',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
