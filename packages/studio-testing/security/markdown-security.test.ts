import { describe, expect, it } from 'vitest';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { parseMarkdownToHtml, isSafeUrl } from '@vibress/studio-utils';

function makeDocWithLink(url: string, text = 'Click here') {
  return {
    schema: 'vibress-studio',
    version: 1,
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url,
              children: [{ type: 'text', text, version: 1 }],
              version: 1,
            },
          ],
          version: 1,
        },
      ],
      version: 1,
    },
  };
}

describe('Secure Markdown export (STU-R05)', () => {
  it('blocks executable and obfuscated URL schemes in Markdown link export', () => {
    const maliciousUrls = [
      'javascript:alert(1)',
      '   javascript:alert(2)',
      'JAVASCRIPT:alert(3)',
      'java\0script:alert(4)',
      'java\tscript:alert(5)',
      'java\nscript:alert(6)',
      'vbscript:msgbox(1)',
      'VBSCRIPT:alert(1)',
      'file:///etc/passwd',
      'data:text/html,<script>alert(1)</script>',
      'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
      '&#106;avascript:alert(1)',
    ];

    for (const badUrl of maliciousUrls) {
      expect(isSafeUrl(badUrl)).toBe(false);
      const doc = makeDocWithLink(badUrl, 'Malicious Link');
      const md = studioDocumentToMarkdown(doc);
      // Markdown must NOT contain the executable scheme
      expect(md).not.toContain(badUrl);
      expect(md).not.toMatch(/\[Malicious Link\]\(\s*javascript:/i);
      expect(md).not.toMatch(/\[Malicious Link\]\(\s*vbscript:/i);
      expect(md).not.toMatch(/\[Malicious Link\]\(\s*data:text/i);

      // Downstream HTML rendering from this Markdown must not execute
      const html = parseMarkdownToHtml(md);
      expect(html).not.toMatch(/href=["']\s*javascript:/i);
      expect(html).not.toMatch(/href=["']\s*vbscript:/i);
      expect(html).not.toMatch(/<script/i);
    }
  });

  it('preserves valid safe URLs and relative links', () => {
    const safeUrls = [
      'https://example.com/path?foo=bar',
      'http://example.com/welcome',
      '/local/article/123',
      '#section-heading',
      'mailto:editor@vibress.com',
      'tel:+15551234567',
    ];

    for (const safeUrl of safeUrls) {
      expect(isSafeUrl(safeUrl)).toBe(true);
      const doc = makeDocWithLink(safeUrl, 'Safe Link');
      const md = studioDocumentToMarkdown(doc);
      expect(md).toContain(`[Safe Link](${safeUrl})`);
    }
  });

  it('escapes Markdown special characters in link destinations and labels', () => {
    // Parentheses in URL must be escaped
    const urlWithParens = 'https://en.wikipedia.org/wiki/Closure_(computer_programming)';
    const doc1 = makeDocWithLink(urlWithParens, 'Wikipedia Closure');
    const md1 = studioDocumentToMarkdown(doc1);
    expect(md1).toContain('https://en.wikipedia.org/wiki/Closure_\\(computer_programming\\)');

    // Spaces in URL must be encoded
    const urlWithSpace = 'https://example.com/my page';
    const doc2 = makeDocWithLink(urlWithSpace, 'Link');
    const md2 = studioDocumentToMarkdown(doc2);
    expect(md2).toContain('https://example.com/my%20page');

    // Square brackets in link text must be escaped
    const doc3 = makeDocWithLink('https://example.com', 'Feature [Beta]');
    const md3 = studioDocumentToMarkdown(doc3);
    expect(md3).toContain('[Feature \\[Beta\\]](https://example.com)');
  });

  it('supports Arabic and mixed-direction text in Markdown links', () => {
    const doc = makeDocWithLink('https://example.com/مقال', 'اقرأ المزيد هنا');
    const md = studioDocumentToMarkdown(doc);
    expect(md).toContain('[اقرأ المزيد هنا](https://example.com/مقال)');

    const html = parseMarkdownToHtml(md);
    expect(html).toContain('اقرأ المزيد هنا');
  });

  it('safely exports image and button cards with validated URLs', () => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      root: {
        type: 'root',
        children: [
          {
            type: 'studio-card',
            cardType: 'image',
            cardData: {
              src: 'https://example.com/safe.png',
              alt: 'Safe Image [High Res]',
            },
            version: 1,
          },
          {
            type: 'studio-card',
            cardType: 'image',
            cardData: {
              src: 'javascript:alert(1)',
              alt: 'XSS Image',
            },
            version: 1,
          },
          {
            type: 'studio-card',
            cardType: 'button',
            cardData: {
              text: 'Click [Me]',
              url: 'https://example.com/action',
            },
            version: 1,
          },
        ],
        version: 1,
      },
    };

    const md = studioDocumentToMarkdown(doc);
    // Safe image exported with escaped brackets in alt
    expect(md).toContain('![Safe Image \\[High Res\\]](https://example.com/safe.png)');
    // Dangerous image must not emit executable src
    expect(md).not.toContain('javascript:alert(1)');
    // Safe button exported with escaped brackets in text
    expect(md).toContain('[Click \\[Me\\]](https://example.com/action)');
  });
});
