import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// No emoji as icons anywhere in the app (owner, 2026-10-05): they look different on every phone, cannot be tinted or sized,
// and look unfinished. Icons come from the icon library (`TargetIcon`, `registry/typeIcons.ts`, lucide-react) or are pictures.
// Emoji in a code comment are fine; this scans code and texts (components, locales, the legal / guide texts).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2139}]|\u{FE0F}/u;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|json|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no emoji icons', () => {
  it('the app code, locales and texts contain no emoji (comments excepted)', () => {
    const found: string[] = [];
    for (const path of files(join(process.cwd(), 'src'))) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const code = line.trim();
          if (!EMOJI.test(line) || /^(\/\/|\/\*|\*)/.test(code)) return;
          if (EMOJI.test(line.split(' // ')[0])) found.push(`${path.replace(process.cwd() + '/', '')}:${i + 1}: ${code.slice(0, 80)}`);
        });
    }
    expect(found).toEqual([]);
  });
});
