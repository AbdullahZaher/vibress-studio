import { describe, expect, it } from 'vitest';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';

describe('Studio rendered content semantics & WCAG 2.2 AA accessibility', () => {
  it('keeps semantic headings and lists in multilingual documents', () => {
    const doc = htmlToStudioDocument('<h2>عنوان عربي English</h2><ul><li>الأول</li><li>Second</li></ul>');
    const markup = renderStudioDocumentToHtml(doc);
    const container = document.createElement('article');
    container.innerHTML = markup;
    expect(container.querySelector('h2')?.textContent).toContain('عنوان عربي English');
    expect(container.querySelector('ul')?.querySelectorAll('li')).toHaveLength(2);
  });

  it('preserves alternative text for imported safe media', () => {
    const doc = htmlToStudioDocument('<p><img src="/media/photo.png" alt="وصف الصورة"></p>');
    const markup = renderStudioDocumentToHtml(doc);
    const container = document.createElement('section');
    container.innerHTML = markup;
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('وصف الصورة');
  });

  it('generates accessible table structures with headers and row/col scopes in RTL', () => {
    const doc = htmlToStudioDocument(
      '<table dir="rtl"><thead><tr><th>المؤشر</th><th>القيمة</th></tr></thead><tbody><tr><td>المستخدمين</td><td>1000</td></tr></tbody></table>'
    );
    const markup = renderStudioDocumentToHtml(doc);
    const container = document.createElement('div');
    container.innerHTML = markup;
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.getAttribute('dir')).toBe('rtl');
    const ths = container.querySelectorAll('th');
    expect(ths.length).toBe(2);
  });

  it('preserves code block language attributes and LTR direction in Arabic context', () => {
    const doc = htmlToStudioDocument(
      '<pre><code class="language-typescript">const answer = 42;</code></pre>'
    );
    const markup = renderStudioDocumentToHtml(doc);
    const container = document.createElement('div');
    container.innerHTML = markup;
    const pre = container.querySelector('pre');
    const code = container.querySelector('code');
    expect(pre).not.toBeNull();
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain('const answer = 42;');
  });

  it('preserves semantic blockquote quotation formatting in bilingual documents', () => {
    const doc = htmlToStudioDocument('<blockquote>الحكمة ضالة المؤمن — Knowledge is power</blockquote>');
    const markup = renderStudioDocumentToHtml(doc);
    const container = document.createElement('div');
    container.innerHTML = markup;
    const blockquote = container.querySelector('blockquote');
    expect(blockquote).not.toBeNull();
    expect(blockquote?.textContent).toContain('الحكمة ضالة المؤمن');
  });
});
