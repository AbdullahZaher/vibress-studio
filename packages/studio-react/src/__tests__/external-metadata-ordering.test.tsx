import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { $getRoot, $getSelection, $createParagraphNode, $createTextNode, UNDO_COMMAND, REDO_COMMAND, type LexicalEditor } from 'lexical';
import { createDefaultStudioDocument, type StudioDocument } from '@vibress/studio-core';
import { VibressStudio, type VibressStudioProps } from '../VibressStudio';

function document(status: string) {
  return { ...createDefaultStudioDocument('Original'), publicationMetadata: { status }, futureEnvelope: { retained: true } };
}
function mount() {
  let instance: LexicalEditor | null = null;
  const onChange = vi.fn<(doc: StudioDocument) => void>();
  const onError = vi.fn();
  const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
  // The additive prop is the host's monotonic metadata authorization, not a save label.
  const props = { onChange, onError, onEditorReady, metadataRevision: 1 };
  const view = render(<VibressStudio value={document('old')} {...props} />);
  const editor = instance! as LexicalEditor;
  const update = async (value: unknown, extra: Partial<VibressStudioProps> = {}) => {
    await act(async () => { view.rerender(<VibressStudio value={value} {...props} {...extra} />); });
  };
  const edit = async (text: string) => {
    await act(async () => { editor.update(() => {
      const p = $createParagraphNode().append($createTextNode(text));
      $getRoot().clear().append(p); p.selectEnd();
    }, { discrete: true, tag: 'history-push' }); });
  };
  const latest = () => onChange.mock.calls.at(-1)![0];
  const text = () => editor.getEditorState().read(() => $getRoot().getTextContent());
  return { ...view, editor, onChange, onError, update, edit, latest, text };
}

describe('authorized external envelope metadata (CR-01)', () => {
  it('accepts identical-root metadata without an emission; the next edit preserves it and unknown fields', async () => {
    const v = mount(); const before = v.onChange.mock.calls.length;
    await v.update(document('new'), { metadataRevision: 2 });
    expect(v.onChange).toHaveBeenCalledTimes(before);
    await v.edit('Local edit');
    expect(v.latest()).toMatchObject({ publicationMetadata: { status: 'new' }, futureEnvelope: { retained: true } });
  });

  it('rejects out-of-order, repeated, and unsequenced echoes after newer metadata and local edits', async () => {
    const v = mount();
    await v.edit('Edit A'); const stale = v.latest();
    await v.update({ ...stale, publicationMetadata: { status: 'new' } }, { metadataRevision: 5 });
    await v.edit('Edit B');
    let currentText = 'Edit B';
    for (const metadataRevision of [3, 5, undefined]) {
      await v.update(stale, { metadataRevision, revisionId: 'later-save-label' });
      expect(v.text()).toBe(currentText);
      currentText = `Still local ${String(metadataRevision)}`;
      await v.edit(currentText);
      expect(v.latest().publicationMetadata).toEqual({ status: 'new' });
    }
  });

  it('applies ordered envelope updates around a stale root without replacing content or resetting dirty protection', async () => {
    const v = mount(); await v.edit('Unsaved');
    await v.update(document('new'), { metadataRevision: 2, revisionId: 100 });
    expect(v.text()).toBe('Unsaved');
    await v.update(createDefaultStudioDocument('Unauthorized replacement'), { metadataRevision: undefined });
    expect(v.text()).toBe('Unsaved');
    await v.edit('Next'); expect(v.latest().publicationMetadata).toEqual({ status: 'new' });
  });

  it('preserves selection, undo and redo; metadata acknowledgments do not emit', async () => {
    const v = mount(); await v.edit('First'); await v.edit('Second');
    const selection = v.editor.getEditorState().read(() => $getSelection()?.clone());
    const state = v.editor.getEditorState(); const count = v.onChange.mock.calls.length;
    await v.update(document('new'), { metadataRevision: 2 });
    expect(v.editor.getEditorState()).toBe(state);
    v.editor.getEditorState().read(() => expect(selection?.is($getSelection())).toBe(true));
    expect(v.onChange).toHaveBeenCalledTimes(count);
    await act(async () => { v.editor.dispatchCommand(UNDO_COMMAND, undefined); });
    expect(v.text()).toBe('First'); expect(v.latest().publicationMetadata).toEqual({ status: 'new' });
    await act(async () => { v.editor.dispatchCommand(REDO_COMMAND, undefined); });
    expect(v.text()).toBe('Second');
  });

  it('requires replacementId to replace content and starts a fresh metadata sequence for that document', async () => {
    const v = mount(); await v.edit('Draft');
    const replacement = { ...createDefaultStudioDocument('Replaced'), publicationMetadata: { status: 'replacement' } };
    await v.update(replacement, { metadataRevision: 2, revisionId: 2 });
    expect(v.text()).toBe('Draft');
    await v.update(replacement, { replacementId: 'switch', metadataRevision: 0 });
    expect(v.text()).toBe('Replaced');
    await v.update({ ...replacement, publicationMetadata: { status: 'after switch' } }, { replacementId: 'switch', metadataRevision: 1 });
    await v.edit('New draft'); expect(v.latest().publicationMetadata).toEqual({ status: 'after switch' });
  });

  it('does not consume authorization for schema/resource-invalid input; recovers with the same sequence', async () => {
    const v = mount(); await v.edit('Draft');
    for (const value of [{ ...document('bad'), version: 2 }, { ...document('bad'), huge: 'x'.repeat(5 * 1024 * 1024 + 1) }]) {
      await v.update(value, { metadataRevision: 2 });
      expect(screen.getByRole('alert')).toBeTruthy(); expect(v.text()).toBe('Draft');
    }
    await v.update(document('recovered'), { metadataRevision: 2 });
    expect(screen.queryByRole('alert')).toBeNull(); expect(v.text()).toBe('Draft');
    await v.edit('Recovered draft'); expect(v.latest().publicationMetadata).toEqual({ status: 'recovered' });
  });

  it('keeps unsequenced metadata ambiguous and revisionId informational, even with identical roots', async () => {
    const v = mount(); await v.edit('Draft'); const echo = v.latest();
    await v.update({ ...echo, publicationMetadata: { status: 'unauthorized' } }, { metadataRevision: undefined, revisionId: 999 });
    await v.edit('Next'); expect(v.latest().publicationMetadata).toEqual({ status: 'old' });
  });
});
