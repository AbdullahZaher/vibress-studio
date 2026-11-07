import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, $isElementNode, $isTextNode, type LexicalEditor } from 'lexical';
import { $isTableCellNode } from '@lexical/table';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { assertStudioDocumentEditable, type StudioDocument } from '@vibress/studio-core';
import { createDefaultStudioDocument, isStudioMigrationError } from '@vibress/studio-core';
import { VibressStudio } from '../VibressStudio';
import { htmlToStudioDocument } from '@vibress/studio-html';

describe('editable node admission (STU-201/STU-205)', () => {
  it.each([
    { type: 'text', text: 42 },
    { type: 'heading', tag: 42, children: [] },
    { type: 'paragraph', children: [], indent: 'invalid' },
    { type: 'link', url: {}, children: [] },
    { type: 'tablecell', children: [], colSpan: -1 },
    { type: 'studio-card', cardType: 'image', cardData: null },
    { type: 'studio-card', cardType: 'image', cardData: { src: 42 } },
    { type: 'studio-card', cardType: 'gallery', cardData: { images: [null] } },
    { type: 'studio-card', cardType: 'html', cardData: { html: 42 } },
    { type: 'studio-card', cardType: 'image', cardData: { src: 'blob:https://example.com/temporary' } },
    { type: 'studio-card', cardType: 'image', cardData: { src: 'data:image/png;base64,iVBOR' } },
    { type: 'studio-card', cardType: 'video', cardData: { src: '/media/video.mp4', poster: 'blob:https://example.com/poster' } },
    { type: 'text', text: 'Newer node', version: 2 },
    { type: 'paragraph', children: [], futureField: { important: 'Keep' } },
  ])('requires recovery for malformed or unsupported fields on $type', (node) => {
    const onError = vi.fn();
    const onChange = vi.fn();
    const onEditorReady = vi.fn();
    const document = { ...createDefaultStudioDocument(), root: { type: 'root', children: [node] } };
    render(<VibressStudio value={document} onError={onError} onChange={onChange} onEditorReady={onEditorReady} />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(onEditorReady).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    const error = onError.mock.lastCall?.[0];
    expect(isStudioMigrationError(error)).toBe(true);
    if (isStudioMigrationError(error)) expect(error.rawDocument).toBe(document);
  });

  it('preserves unknown envelope/editor metadata in subsequent local snapshots', async () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const onChange = vi.fn();
    const document = {
      ...createDefaultStudioDocument('Saved'),
      publicationMetadata: { important: 'retain' },
      editor: { lexicalVersion: '0.13.1', extension: 'retain' },
    };
    render(<VibressStudio value={document} onEditorReady={onEditorReady} onChange={onChange} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    await act(async () => {
      editor.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('Local draft')));
      }, { discrete: true });
    });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      publicationMetadata: { important: 'retain' }, editor: { extension: 'retain' },
    });
  });

  it('edits and snapshots imported centered paragraphs and RTL headings without losing alignment', async () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const onChange = vi.fn();
    const document = htmlToStudioDocument(
      '<p style="text-align: center">مرحبًا English</p>' +
      '<h2 dir="rtl" style="text-align: right">العنوان</h2>'
    );
    render(<VibressStudio value={document} onEditorReady={onEditorReady} onChange={onChange} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    await act(async () => {
      editor.update(() => {
        $getRoot().append($createParagraphNode().append($createTextNode('New content')));
      }, { discrete: true });
    });
    expect(onChange.mock.lastCall?.[0].root.children).toEqual([
      expect.objectContaining({ type: 'paragraph', format: 'center' }),
      expect.objectContaining({ type: 'heading', format: 'right', direction: 'rtl' }),
      expect.objectContaining({ type: 'paragraph' }),
    ]);
  });

  it('preserves table direction and alignment on import and later editing', async () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const onChange = vi.fn();
    const document = htmlToStudioDocument('<table dir="rtl"><tr><td>العربية English</td></tr></table>');
    render(<VibressStudio value={document} onEditorReady={onEditorReady} onChange={onChange} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    await act(async () => {
      editor.update(() => { $getRoot().append($createParagraphNode().append($createTextNode('More'))); }, { discrete: true });
    });
    expect(onChange.mock.lastCall?.[0].root.children[0]).toMatchObject({ type: 'table', direction: 'rtl' });
  });


  it('edits imported RTL table text and preserves cell background and alignment through reload and public HTML', async () => {
    let instance: LexicalEditor | null = null;
    const onChange = vi.fn();
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const doc = htmlToStudioDocument(
      '<table dir="rtl"><tr><td style="background-color: #abcdef; text-align: center">قبل English</td></tr></table>'
    );
    expect(() => assertStudioDocumentEditable(doc)).not.toThrow();
    const mounted = render(<VibressStudio value={doc} onEditorReady={onEditorReady} onChange={onChange} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    await act(async () => {
      editor.update(() => {
        const table = $getRoot().getFirstChild();
        if (!$isElementNode(table)) throw new Error('Table did not hydrate');
        const row = table.getFirstChild();
        if (!$isElementNode(row)) throw new Error('Table row did not hydrate');
        const cell = row.getFirstChild();
        if (!$isTableCellNode(cell)) throw new Error('Table cell did not hydrate');
        const paragraph = cell.getFirstChild();
        const text = paragraph?.getFirstChild();
        if (!$isTextNode(text)) throw new Error('Cell text did not hydrate');
        text.setTextContent('بعد English updated');
      }, { discrete: true });
    });
    const saved = onChange.mock.lastCall?.[0] as StudioDocument | undefined;
    expect(saved).toBeDefined();
    if (!saved) throw new Error('No editable snapshot');
    const table = saved.root.children[0] as {
      direction?: string;
      children: Array<{ children: Array<Record<string, unknown>> }>;
    };
    const cell = table.children[0]?.children[0];
    expect(table.direction).toBe('rtl');
    expect(cell).toMatchObject({
      type: 'tablecell',
      backgroundColor: '#abcdef',
      format: 'center',
    });
    expect(JSON.stringify(cell)).toContain('بعد English updated');
    expect(() => assertStudioDocumentEditable(saved)).not.toThrow();
    const html = renderStudioDocumentToHtml(saved);
    expect(html).toContain('background-color: #abcdef');
    expect(html).toContain('text-align: center');
    expect(html).toContain('بعد English updated');
    expect(html).toContain('dir="rtl"');

    mounted.unmount();
    let reopened: LexicalEditor | null = null;
    render(<VibressStudio value={JSON.parse(JSON.stringify(saved))} onEditorReady={e => { reopened = e; }} />);
    if (!reopened) throw new Error('Saved editor did not reopen');
    const reloadedEditor: LexicalEditor = reopened;
    reloadedEditor.getEditorState().read(() => {
      const table = $getRoot().getFirstChild();
      if (!$isElementNode(table)) throw new Error('Saved table did not hydrate');
      const row = table.getFirstChild();
      if (!$isElementNode(row)) throw new Error('Saved row did not hydrate');
      const cell = row.getFirstChild();
      expect($isTableCellNode(cell)).toBe(true);
      expect(cell?.getTextContent()).toBe('بعد English updated');
    });
  });

  it('keeps a linked image with rich caption when editing an adjacent block', async () => {
    let instance: LexicalEditor | null = null;
    const onChange = vi.fn();
    const doc = htmlToStudioDocument(
      '<figure><a href="https://example.com/article"><img src="/media/cover.png" alt="Cover"></a>' +
      '<figcaption>عنوان <strong>مهم</strong></figcaption></figure><p>Next paragraph</p>'
    );
    render(<VibressStudio value={doc} onEditorReady={e => { instance = e; }} onChange={onChange} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    await act(async () => {
      editor.update(() => { $getRoot().append($createParagraphNode().append($createTextNode('After media'))); }, { discrete: true });
    });
    const saved = onChange.mock.lastCall?.[0] as StudioDocument | undefined;
    expect(saved).toBeDefined();
    if (!saved) throw new Error('No snapshot');
    expect(saved.root.children[0]).toMatchObject({
      type: 'studio-card',
      cardType: 'image',
      cardData: {
        src: '/media/cover.png',
        href: 'https://example.com/article',
        caption: 'عنوان مهم',
        captionHtml: 'عنوان <strong>مهم</strong>',
      },
    });
  });
  it('can explicitly restore a valid empty root without a parse error or remount', async () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const onError = vi.fn();
    const { rerender } = render(<VibressStudio value={createDefaultStudioDocument('Saved')} replacementId="first" onEditorReady={onEditorReady} onError={onError} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    const empty = { schema: 'vibress-studio', version: 1, root: { type: 'root', children: [], version: 1 } };
    await act(async () => {
      rerender(<VibressStudio value={empty} replacementId="empty" onEditorReady={onEditorReady} onError={onError} />);
    });
    expect(instance).toBe(editor);
    expect(onError).not.toHaveBeenCalled();
    editor.getEditorState().read(() => { expect($getRoot().getTextContent()).toBe(''); });
  });
});
