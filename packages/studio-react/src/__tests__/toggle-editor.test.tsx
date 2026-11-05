import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ParagraphNode, TextNode } from 'lexical';
import { StudioCardNode } from '@vibress/studio-cards';
import { ToggleCardEditor, hasToggleHtmlMarkup, resolveToggleHtmlSourceEdit } from '../components/cards/ToggleCardEditor';

const wrap = (cardData: { heading: string; content: string }) => render(
  <LexicalComposer initialConfig={{
    namespace: 'ToggleEditorTest',
    editable: true,
    nodes: [ParagraphNode, TextNode, StudioCardNode],
    onError: (error: Error) => { throw error; },
  }}>
    <ToggleCardEditor nodeKey="toggle-test" cardData={cardData} />
  </LexicalComposer>
);

describe('Toggle card rich content authoring', () => {
  it('shows sanitized formatted content without exposing source markup in a textarea', () => {
    const { container } = wrap({
      heading: 'أسئلة شائعة',
      content: '<p dir="rtl">إجابة <strong>مهمة</strong></p><img src="x" onerror="alert(1)"><script>alert(2)</script>',
    });
    const preview = screen.getByLabelText('Formatted toggle content');
    expect(preview.querySelector('strong')?.textContent).toBe('مهمة');
    expect(preview.querySelector('[onerror]')).toBeNull();
    expect(preview.querySelector('script')).toBeNull();
    expect(preview.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(container.querySelector('textarea[aria-label="Toggle HTML source"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit HTML source' })).not.toBeNull();
  });

  it('keeps source changes local until explicit apply, and permits cancellation', () => {
    wrap({ heading: 'FAQ', content: '<p>Original <strong>answer</strong></p>' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit HTML source' }));
    const source = screen.getByRole('textbox', { name: 'Toggle HTML source' }) as HTMLTextAreaElement;
    expect(source.value).toContain('<strong>answer</strong>');
    fireEvent.change(source, { target: { value: '<p>Unsaved</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Toggle HTML source' })).toBeNull();
    expect(screen.getByLabelText('Formatted toggle content').textContent).toContain('Original answer');
  });

  it('keeps plain text directly editable and does not interpret standalone text as HTML', () => {
    wrap({ heading: 'Title', content: 'Ordinary text' });
    expect((screen.getByRole('textbox', { name: 'Toggle content' }) as HTMLTextAreaElement).value)
      .toBe('Ordinary text');
    expect(screen.queryByRole('button', { name: 'Edit HTML source' })).toBeNull();
    expect(hasToggleHtmlMarkup('3 < 5 and 8 > 6')).toBe(false);
    expect(hasToggleHtmlMarkup('<p>مرحبا <em>بالعالم</em></p>')).toBe(true);
  });

  it('sanitizes applied HTML source without dropping the latest unrelated card metadata', () => {
    const current = {
      content: '<p>Old</p>',
      heading: 'Updated heading',
      extraFutureMetadata: { keep: true },
    };
    const next = resolveToggleHtmlSourceEdit(
      current,
      '<p>Old</p>',
      '<p>New <strong>answer</strong></p><img src="/a.jpg" onerror="alert(1)"><script>alert(2)</script>',
    );
    expect(next?.heading).toBe('Updated heading');
    expect(next?.extraFutureMetadata).toEqual({ keep: true });
    expect(next?.content).toContain('New <strong>answer</strong>');
    expect(next?.content).not.toContain('onerror');
    expect(next?.content).not.toContain('<script');
    expect(current.content).toBe('<p>Old</p>');
  });

  it('rejects applying stale source drafts after a concurrent body edit', () => {
    const current = { content: '<p>Newer content</p>', heading: 'Unchanged' };
    expect(resolveToggleHtmlSourceEdit(current, '<p>Old content</p>', '<p>Author draft</p>')).toBeNull();
    expect(current.content).toBe('<p>Newer content</p>');
  });

  it('keeps keyboard-operable disclosure controls with meaningful accessible names', () => {
    wrap({ heading: 'Details', content: '<p>Body</p>' });
    const button = screen.getByRole('button', { name: 'Collapse toggle' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(screen.queryByLabelText('Formatted toggle content')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand toggle' }).getAttribute('aria-expanded')).toBe('false');
  });
});
