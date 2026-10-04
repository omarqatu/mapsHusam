import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { manualStars } from '@/features/map/extras/featured';
import StarRating from './StarRating';

describe('manualStars', () => {
  it('turns the hand-set score out of 10 into stars out of 5', () => {
    expect(manualStars(10)).toBe(5);
    expect(manualStars(9.9)).toBeCloseTo(4.95);
    expect(manualStars(0)).toBe(0);
    expect(manualStars(14)).toBe(5);
    expect(manualStars(-3)).toBe(0);
  });
});

describe('StarRating (display only)', () => {
  it('names its value out of 5 and fills a fraction of the last star', () => {
    const { container } = render(<StarRating value={3.5} label="Rating" />);
    expect(screen.getByRole('img', { name: 'Rating 3.5/5' })).toBeTruthy();
    // one clip per star: three full, one half, one empty
    const widths = [...container.querySelectorAll<HTMLElement>('span[style]')].map((e) => e.style.width);
    expect(widths).toEqual(['100%', '100%', '100%', '50%', '0%']);
  });

  it('clamps values outside 0-5', () => {
    render(<StarRating value={9} label="R" />);
    expect(screen.getByRole('img', { name: 'R 5/5' })).toBeTruthy();
  });
});
