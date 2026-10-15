import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/i18n';
import HourPresets from './HourPresets';

// The chips read as hours ("24 ساعة"), not as the stored value ("00:00-23:59").
describe('HourPresets', () => {
  it('labels each choice in words and marks the current one', () => {
    render(<HourPresets value="08:00-17:00" onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: '24 ساعة' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '8 ص – 5 م' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/00-23|23:59/)).toBeNull();
  });
});
