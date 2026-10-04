import { describe, expect, it } from 'vitest';
import { notificationTarget } from './target';

describe('notificationTarget', () => {
  it('opens a request chat', () => {
    expect(notificationTarget('request:42')).toEqual({ kind: 'request', id: 42 });
  });

  it('opens an app page', () => {
    expect(notificationTarget('/admin/submissions')).toEqual({ kind: 'page', path: '/admin/submissions' });
    expect(notificationTarget('/add-listing')).toEqual({ kind: 'page', path: '/add-listing' });
  });

  it('has no target for missing, external or malformed links', () => {
    for (const link of [
      null,
      undefined,
      '',
      'request:0',
      'request:abc',
      '//evil.example',
      'https://x.y',
      '/\\evil',
      'javascript:alert(1)',
      'admin',
    ])
      expect(notificationTarget(link), String(link)).toEqual({ kind: 'none' });
  });
});
