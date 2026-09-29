import { describe, expect, it } from 'vitest';
import {
  cleanItems,
  collectBatch,
  effective,
  moveById,
  moveItem,
  sameItems,
  setEdit,
  toTextItem,
  withoutEdits,
} from './model';

describe('group rows', () => {
  it('cleanItems trims, omits empty values and drops rows without an id; keeps unknown keys', () => {
    expect(
      cleanItems([
        { id: ' a ', label: ' Dollar ', value: '', extra: 'kept' },
        { id: '  ', label: 'no id' },
        { id: 'b', unit: '' },
      ]),
    ).toEqual([{ id: 'a', label: 'Dollar', extra: 'kept' }, { id: 'b' }]);
  });
  it('toTextItem stringifies numbers and drops nulls', () => {
    expect(toTextItem({ id: 'x', temp: 28, wind: null })).toEqual({ id: 'x', temp: '28' });
    expect(toTextItem(null)).toEqual({});
  });
  it('sameItems ignores whitespace and id-less rows', () => {
    expect(sameItems([{ id: 'a', value: ' 1 ' }, { id: '' }], [{ id: 'a', value: '1' }])).toBe(true);
    expect(sameItems([{ id: 'a', value: '2' }], [{ id: 'a', value: '1' }])).toBe(false);
  });
  it('moveItem / moveById reorder and clamp', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, 5)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 1, -4)).toEqual([2, 1, 3]);
    expect(moveById([10, 20, 30], 30, 10)).toEqual([30, 10, 20]);
  });
});

describe('pending status edits', () => {
  const saved = { id: 5, stop: 0, stop2: null };
  it('keeps only fields that differ from the saved value', () => {
    let e = setEdit({}, 5, 'stop', '1', saved);
    expect(e).toEqual({ 5: { stop: '1' } });
    e = setEdit(e, 5, 'stop2', '3', saved);
    expect(e).toEqual({ 5: { stop: '1', stop2: '3' } });
    e = setEdit(e, 5, 'stop', '0', saved); // back to the saved value
    expect(e).toEqual({ 5: { stop2: '3' } });
    expect(setEdit(e, 5, 'stop2', '', saved)).toEqual({});
  });
  it('effective shows the edit, else the saved value, else ""', () => {
    expect(effective({ 5: { stop: '2' } }, 5, 'stop', saved)).toBe('2');
    expect(effective({}, 5, 'stop', saved)).toBe('0');
    expect(effective({}, 5, 'stop2', saved)).toBe('');
  });
  it('collectBatch sends changed fields only; withoutEdits drops saved ones', () => {
    const e = { 5: { stop: '1' }, 6: { stop: '2', stop2: '4' } };
    expect(collectBatch(e)).toEqual([
      { id: 5, stop: '1' },
      { id: 6, stop: '2', stop2: '4' },
    ]);
    expect(withoutEdits(e, [6], ['stop'])).toEqual({ 5: { stop: '1' }, 6: { stop2: '4' } });
    expect(withoutEdits(e, [5, 6], ['stop', 'stop2'])).toEqual({});
  });
});
