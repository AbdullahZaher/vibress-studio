import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
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
