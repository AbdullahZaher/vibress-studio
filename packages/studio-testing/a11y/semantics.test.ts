import { describe, expect, it } from 'vitest';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';

describe('Studio rendered content semantics', () => {
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
});
