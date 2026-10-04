import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/i18n';
import SelectInput from './SelectInput';

const options = [
  { value: 'rent', label: 'Rent', group: 'Real estate' },
  { value: 'sale', label: 'Sale', group: 'Real estate' },
  { value: 'plumber', label: 'Plumber', group: 'Services' },
  { value: 'painter', label: 'Painter', group: 'Services', disabled: true },
  { value: 'pharmacy', label: 'Pharmacy', group: 'Services' },
];

describe('SelectInput (themed listbox)', () => {
  it('opens on click, shows group headings, picks with the mouse and closes', async () => {
    const onChange = vi.fn();
    render(<SelectInput aria-label="type" options={options} placeholder="Choose" onChange={onChange} />);
    const box = screen.getByRole('combobox', { name: 'type' });
    expect(box).toHaveTextContent('Choose');
    await userEvent.click(box);
    expect(screen.getByText('Real estate')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'Plumber' }));
    expect(onChange).toHaveBeenCalledWith({ target: { value: 'plumber', name: undefined } });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keyboard: arrows skip disabled options, Enter picks, Escape closes', async () => {
    const onChange = vi.fn();
    render(<SelectInput aria-label="type" options={options} value="plumber" onChange={onChange} />);
    const box = screen.getByRole('combobox');
    box.focus();
    await userEvent.keyboard('{ArrowDown}'); // opens on the selected option (Plumber)
    expect(screen.getByRole('option', { name: 'Plumber' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}{Enter}'); // Painter is disabled → Pharmacy
    expect(onChange).toHaveBeenLastCalledWith({ target: { value: 'pharmacy', name: undefined } });
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box).toHaveFocus();
  });

  it('type-ahead jumps to the first matching label', async () => {
    const onChange = vi.fn();
    render(<SelectInput aria-label="type" options={options} onChange={onChange} />);
    screen.getByRole('combobox').focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('ph{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ target: { value: 'pharmacy', name: undefined } });
  });

  it('searchable: filters the list and Enter picks the first match', async () => {
    const onChange = vi.fn();
    render(<SelectInput aria-label="type" options={options} onChange={onChange} searchable />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('sal');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ target: { value: 'sale', name: undefined } });
  });

  it('closes when clicking outside; disabled cannot open', async () => {
    const { rerender } = render(
      <div>
        <SelectInput aria-label="type" options={options} />
        <p>outside</p>
      </div>,
    );
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByText('outside'));
    expect(screen.queryByRole('listbox')).toBeNull();
    rerender(<SelectInput aria-label="type" options={options} disabled />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
