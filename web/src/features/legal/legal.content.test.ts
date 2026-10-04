import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LEGAL_KEYS, loadLegalDoc } from './content';
import pinned from './texts.sha256.json';

/**
 * The legal texts are the owner's wording. `texts.sha256.json` pins each document as it was when it lived in
 * `content.ts` (sha256 + length of `JSON.stringify(doc)`, measured on that file at the commit before the move).
 * If you change a text ON PURPOSE, update its entry here in the same commit:
 *   node -e "const d=require('./texts/<key>.json');const s=JSON.stringify(d);console.log(require('crypto').createHash('sha256').update(s).digest('hex'),s.length)"
 */
const hashes = pinned as Record<string, { sha256: string; length: number }>;

describe('legal texts are pinned byte for byte', () => {
  it('every text file has a pin and every pin has a file', () => {
    expect([...LEGAL_KEYS].sort()).toEqual(Object.keys(hashes).sort());
  });

  it.each(LEGAL_KEYS)('%s is identical to the text that lived in content.ts', async (key) => {
    const s = JSON.stringify(await loadLegalDoc(key));
    expect(s.length).toBe(hashes[key].length);
    expect(createHash('sha256').update(s, 'utf8').digest('hex')).toBe(hashes[key].sha256);
  });
});
