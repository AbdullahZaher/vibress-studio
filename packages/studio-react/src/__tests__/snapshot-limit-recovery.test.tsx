import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, LexicalEditor } from 'lexical';
import { createEmptyStudioDocument } from '@vibress/studio-core';
import { VibressStudio } from '../VibressStudio';

describe('VibressStudio outgoing resource-limit recovery', () => {
  it('preserves the live draft and blocks invalid onChange snapshots until content is reduced', async () => {
    let editor: LexicalEditor | null = null;
    const onChange = vi.fn();
    const onError = vi.fn();

    render(
      <VibressStudio
        value={createEmptyStudioDocument()}
        resourceLimits={{ maxSizeBytes: 1024, maxNodeCount: 100, maxDepth: 64 }}
        onChange={onChange}
        onError={onError}
        onEditorReady={(instance) => { editor = instance; }}
      />
    );
    await waitFor(() => expect(editor).not.toBeNull());
    await act(async () => {}); // Let initial external state settle.
    const previousEmits = onChange.mock.calls.length;

    await act(async () => {
      editor!.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('مرحبا 😀'.repeat(300))));
      }, { discrete: true });
    });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Document not saved'));
    expect(onChange).toHaveBeenCalledTimes(previousEmits);
    expect(onError).toHaveBeenCalled();
    let liveText = '';
    editor!.getEditorState().read(() => { liveText = $getRoot().getTextContent(); });
    expect(liveText.length).toBeGreaterThan(1000); // The editor's draft was not discarded.

    await act(async () => {
      editor!.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('Safe short revision')));
      }, { discrete: true });
    });
    await waitFor(() => expect(onChange.mock.calls.length).toBeGreaterThan(previousEmits));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(onChange.mock.lastCall?.[0]?.root?.children).toBeDefined();
  });
});
