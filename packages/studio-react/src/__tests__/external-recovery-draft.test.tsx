import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, UNDO_COMMAND, type LexicalEditor, type ParagraphNode } from 'lexical';
import { createDefaultStudioDocument, isStudioMigrationError } from '@vibress/studio-core';
import { VibressStudio } from '../VibressStudio';

describe('external document recovery preserves the active draft (STU-205/STU-302)', () => {
  it.each([
    { name: 'invalid envelope', value: { schema: 'vibress-studio', version: 1, root: null } },
    { name: 'unsupported node', value: {
      schema: 'vibress-studio', version: 1,
      root: { type: 'root', children: [{ type: 'future-node', payload: 'Keep this too' }] },
    } },
    { name: 'resource limit', value: createDefaultStudioDocument('x'.repeat(2048)) },
  ])('pauses without unmounting or autosaving after an incoming $name error', async ({ value }) => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = vi.fn((editor: LexicalEditor | null) => { instance = editor; });
    const onChange = vi.fn();
    const onError = vi.fn();
    const initial = createDefaultStudioDocument('Saved article');
    const props = { onEditorReady, onChange, onError, resourceLimits: { maxSizeBytes: 1024 } };
    const { rerender } = render(<VibressStudio {...props} value={initial} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;

    await act(async () => {
      editor.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('مسودة unsaved draft')));
      }, { discrete: true });
    });
    const draft = editor.getEditorState();
    const emissions = onChange.mock.calls.length;

    rerender(<VibressStudio {...props} value={value} />);

    expect(onEditorReady).toHaveBeenCalledTimes(1);
    expect(instance).toBe(editor);
    expect(editor.getEditorState()).toBe(draft);
    expect(editor.isEditable()).toBe(false);
    expect(screen.getByRole('alert').textContent).toContain('Editing paused');
    const error = onError.mock.lastCall?.[0];
    expect(isStudioMigrationError(error)).toBe(true);
    if (isStudioMigrationError(error)) expect(error.rawDocument).toBe(value);

    // Async card completions can still update Lexical while its UI is paused.
    await act(async () => {
      editor.update(() => {
        $getRoot().getFirstChildOrThrow<ParagraphNode>().append($createTextNode(' upload finished'));
      }, { discrete: true });
    });
    expect(onChange).toHaveBeenCalledTimes(emissions);

    // A valid stale host echo resumes the same editor, retaining its live draft.
    rerender(<VibressStudio {...props} value={initial} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(instance).toBe(editor);
    expect(editor.isEditable()).toBe(true);
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('مسودة unsaved draft upload finished');
    });
    expect(onChange).toHaveBeenCalledTimes(emissions);
    await act(async () => {
      editor.update(() => { $getRoot().getFirstChildOrThrow<ParagraphNode>().append($createTextNode(' continued')); }, { discrete: true });
    });
    expect(onChange).toHaveBeenCalledTimes(emissions + 1);
  });

  it('does not consume a replacement token until its document is valid', async () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = vi.fn((editor: LexicalEditor | null) => { instance = editor; });
    const onChange = vi.fn();
    const onError = vi.fn();
    const initial = createDefaultStudioDocument('Saved article');
    const props = { onEditorReady, onChange, onError };
    const { rerender } = render(<VibressStudio {...props} value={initial} replacementId="initial" />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    await act(async () => {
      editor.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('Local draft')));
      }, { discrete: true });
    });

    rerender(<VibressStudio {...props} value={{ corrupt: true }} replacementId="restore" />);
    expect(instance).toBe(editor);
    editor.getEditorState().read(() => { expect($getRoot().getTextContent()).toBe('Local draft'); });

    const emissions = onChange.mock.calls.length;
    await act(async () => {
      rerender(<VibressStudio {...props} value={createDefaultStudioDocument('Authorized restore')} replacementId="restore" />);
    });
    expect(instance).toBe(editor);
    editor.getEditorState().read(() => { expect($getRoot().getTextContent()).toBe('Authorized restore'); });
    expect(onChange).toHaveBeenCalledTimes(emissions);
  });

  it('retains selection and undo history when a rejected update is withdrawn', async () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const initial = createDefaultStudioDocument('Saved article');
    const { rerender } = render(<VibressStudio value={initial} onEditorReady={onEditorReady} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    for (const text of ['First local draft', 'Second local draft']) {
      await act(async () => {
        editor.update(() => {
          const paragraph = $createParagraphNode().append($createTextNode(text));
          $getRoot().clear().append(paragraph);
          paragraph.selectEnd();
        }, { discrete: true, tag: 'history-push' });
      });
    }
    const selection = editor.getEditorState().read(() => $getSelection()?.clone());
    expect(selection).toBeDefined();
    rerender(<VibressStudio value={{ corrupt: true }} onEditorReady={onEditorReady} />);
    rerender(<VibressStudio value={initial} onEditorReady={onEditorReady} />);
    expect(instance).toBe(editor);
    editor.getEditorState().read(() => { expect(selection?.is($getSelection())).toBe(true); });
    await act(async () => { editor.dispatchCommand(UNDO_COMMAND, undefined); });
    editor.getEditorState().read(() => { expect($getRoot().getTextContent()).toBe('First local draft'); });
  });

  it('keeps a read-only host read-only after recovery', () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const initial = createDefaultStudioDocument('Saved article');
    const { rerender } = render(<VibressStudio value={initial} readOnly onEditorReady={onEditorReady} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    rerender(<VibressStudio value={{ corrupt: true }} readOnly onEditorReady={onEditorReady} />);
    rerender(<VibressStudio value={initial} readOnly onEditorReady={onEditorReady} />);
    expect(instance).toBe(editor);
    expect(editor.isEditable()).toBe(false);
  });
});
