import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { createDefaultStudioDocument } from '@vibress/studio-core';
import { VibressStudio } from '../VibressStudio';

describe('host-owned recovery export and localization (STU-205/DES-104/DES-105)', () => {
  it('offers recovery export when an outgoing draft exceeds its saving budget', async () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const onRequestRecovery = vi.fn();
    render(<VibressStudio value={createDefaultStudioDocument('Saved')} resourceLimits={{ maxSizeBytes: 1024 }} onEditorReady={onEditorReady} onRequestRecovery={onRequestRecovery} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    await act(async () => {
      editor.update(() => { $getRoot().clear().append($createParagraphNode().append($createTextNode('x'.repeat(3000)))); }, { discrete: true });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export recovery data' }));
    await waitFor(() => expect(onRequestRecovery).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(onRequestRecovery.mock.calls[0]?.[0].editorState)).toContain('x'.repeat(3000));
    expect(editor.isEditable()).toBe(true); // The author can reduce/repair the draft.
  });
  it('exports the exact rejected original and supports a failed action followed by retry', async () => {
    const original = { unsupported: 'Retain original source' };
    const onRequestRecovery = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined);
    render(<VibressStudio value={original} onRequestRecovery={onRequestRecovery} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export recovery data' }));
    await waitFor(() => expect(screen.getByText('Recovery data could not be exported. Try again.')).toBeDefined());
    expect(onRequestRecovery.mock.calls[0]?.[0].originalValue).toBe(original);
    expect(onRequestRecovery.mock.calls[0]?.[0].editorState).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Export recovery data' }));
    await waitFor(() => expect(onRequestRecovery).toHaveBeenCalledTimes(2));
  });

  it('localizes recovery copy and direction without inferring the document language', () => {
    render(<VibressStudio value={{ invalid: true }} recoveryLocale="ar" />);
    expect(screen.getByRole('alert').getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('alert').getAttribute('lang')).toBe('ar');
    expect(screen.getByText('استرداد مستند الاستوديو')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull(); // No unsupported host action.
  });

  it('includes the current live editor state when the host requests recovery of an active draft', async () => {
    let instance: LexicalEditor | null = null;
    const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
    const onRequestRecovery = vi.fn();
    const props = { onEditorReady, onRequestRecovery };
    const { rerender } = render(<VibressStudio {...props} value={createDefaultStudioDocument('Saved')} />);
    if (!instance) throw new Error('Editor did not initialize');
    const editor: LexicalEditor = instance;
    await act(async () => {
      editor.update(() => { $getRoot().clear().append($createParagraphNode().append($createTextNode('مسودة unsaved'))); }, { discrete: true });
    });
    const rejected = { invalid: true };
    rerender(<VibressStudio {...props} value={rejected} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export recovery data' }));
    await waitFor(() => expect(onRequestRecovery).toHaveBeenCalledTimes(1));
    expect(onRequestRecovery.mock.calls[0]?.[0].originalValue).toBe(rejected);
    expect(JSON.stringify(onRequestRecovery.mock.calls[0]?.[0].editorState)).toContain('مسودة unsaved');
    expect(instance).toBe(editor);
  });
});
