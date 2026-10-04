import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import RichText from '@/components/RichText';
import { legalDocToRich } from '@/features/legal/docToRich';
import { LEGAL_KEYS, loadLegalDoc } from '@/features/legal/content';
import { renderRich } from '@/components/richRender';
import { parseRichHtml, richFromElement, richTreeToHtml, safeUrl, sanitizeRichHtml } from './richText';

describe('safeUrl', () => {
  it('keeps web, mail, phone and in-app addresses', () => {
    expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeUrl('mailto:a@b.co')).toBe('mailto:a@b.co');
    expect(safeUrl('tel:+970590000000')).toBe('tel:+970590000000');
    expect(safeUrl('/search?group=fuel')).toBe('/search?group=fuel');
  });
  it('refuses script, data, protocol-relative and junk', () => {
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,x', '//evil.com', 'vbscript:x', '', 'foo'])
      expect(safeUrl(bad)).toBeNull();
  });
});

describe('the allow-list', () => {
  it('drops scripts, handlers, forms, media and buttons with their content', () => {
    const html =
      '<p onclick="alert(1)">a<script>alert(2)</script></p><img src=x onerror=alert(3)><button onclick="x()">btn</button>' +
      '<iframe src="https://evil"></iframe><form><input value="x"></form><svg><script>alert(4)</script></svg><p>b</p>';
    expect(sanitizeRichHtml(html)).toBe('<p>a</p><p>b</p>');
  });

  it('turns unsafe links into plain text and keeps safe ones', () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a> <a href="https://a.ps" target="_top">y</a>')).toBe(
      'x <a href="https://a.ps/">y</a>',
    );
  });

  it('keeps structure, direction and centring; unwraps span / font; drops every other style', () => {
    const html =
      '<h3 style="color:red;text-align:center">T</h3><div style="background-color:#fff;padding:9px"><font color=red><span style="font-size:40px">x</span></font> <b>y</b> <i>z</i></div><p dir="ltr">L</p>';
    expect(sanitizeRichHtml(html)).toBe(
      '<h3 style="text-align:center">T</h3><div style="background-color:#f8f9fa;padding:16px">x <strong>y</strong> <em>z</em></div><p dir="ltr">L</p>',
    );
  });

  it('lists hold only items (indentation is not text)', () => {
    expect(sanitizeRichHtml('<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>')).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('escapes text, so saved text can never become markup', () => {
    const tree = [{ tag: 'p' as const, children: ['<script>alert(1)</script> & "q"'] }];
    expect(richTreeToHtml(tree)).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; "q"</p>');
    expect(parseRichHtml(richTreeToHtml(tree))).toEqual(tree);
  });

  it('is stable: cleaning clean HTML changes nothing', () => {
    const once = sanitizeRichHtml('<div style="background:#eee"><h2>A</h2><ul><li><a href="/x">b</a></li></ul></div>');
    expect(sanitizeRichHtml(once)).toBe(once);
  });
});

describe('RichText', () => {
  it('renders the allowed parts as elements and nothing executable', () => {
    const { container } = render(
      <MemoryRouter>
        <RichText html={'<h3>Title</h3><p>Hi <a href="https://a.ps">site</a> <a href="/search">in</a></p><script>alert(1)</script><img src=x onerror=alert(1)>'} />
      </MemoryRouter>,
    );
    expect(container.querySelector('script, img, [onerror]')).toBeNull();
    expect(container.querySelector('h3')?.textContent).toBe('Title');
    const external = container.querySelector('a[href="https://a.ps/"]');
    expect(external?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('a[href="/search"]')).not.toBeNull();
  });
});

describe('built-in texts as the editor starting point', () => {
  it('every built-in text converts to non-empty rich text that survives the allow-list unchanged', async () => {
    for (const key of LEGAL_KEYS) {
      const doc = await loadLegalDoc(key);
      const html = richTreeToHtml(legalDocToRich(doc));
      expect(html.length, key).toBeGreaterThan(50);
      expect(sanitizeRichHtml(html), key).toBe(html);
    }
  });
});

describe('the editor round trip', () => {
  it('a framed section, centred text and a block title survive being drawn and read back', () => {
    const tree = parseRichHtml(
      '<div style="background-color:#f8f9fa;padding:16px"><strong style="display:block">T</strong><p style="text-align:center">c</p></div>',
    );
    for (const look of ['read', 'edit'] as const) {
      const { container } = render(<div>{renderRich(tree, '', look)}</div>);
      expect(richFromElement(container.firstElementChild!)).toEqual(tree);
    }
  });
});
