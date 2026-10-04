import { describe, expect, it } from 'vitest';
import { EMPTY_SEND, toPayload, validateSend } from './sendModel';

describe('admin send-notification form', () => {
  it('needs a title and a message, and a target user for "single" / "selected"', () => {
    expect(validateSend(EMPTY_SEND)).toEqual({ userId: 'required', title: 'required', message: 'required' });
    expect(validateSend({ ...EMPTY_SEND, target: 'selected', title: 'a', message: 'b' })).toEqual({
      selected: 'required',
    });
    expect(validateSend({ ...EMPTY_SEND, userId: '12x', title: 'a', message: 'b' }).userId).toBe('invalid');
    expect(validateSend({ ...EMPTY_SEND, target: 'online', title: 'a', message: 'b' })).toEqual({});
  });

  it('builds the payload the server reads', () => {
    expect(
      toPayload({ ...EMPTY_SEND, userId: ' 96 ', title: ' T ', message: ' M ', type: 'warning' }),
    ).toEqual({
      targetType: 'single',
      targetUserId: 96,
      title: 'T',
      message: 'M',
      type: 'warning',
    });
    expect(
      toPayload({ ...EMPTY_SEND, target: 'selected', selected: [3, 3, 5], title: 'T', message: 'M' }),
    ).toMatchObject({
      targetType: 'selected',
      targetUserIds: [3, 5],
    });
    expect(
      toPayload({ ...EMPTY_SEND, target: 'providers', userId: '9', title: 'T', message: 'M' }),
    ).not.toHaveProperty('targetUserId');
  });
});
