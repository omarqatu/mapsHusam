import ar from './locales/ar.json';
import en from './locales/en.json';

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('locales', () => {
  it('ar.json and en.json have exactly the same keys', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
});
