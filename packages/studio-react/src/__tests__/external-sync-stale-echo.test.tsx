import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { LexicalEditor, $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { StudioDocument, createDefaultStudioDocument } from '@vibress/studio-core';
import { VibressStudio } from '../VibressStudio';

describe('VibressStudio external synchronization and stale echo protection (Phase A)', () => {
  it('protects newer local edits when a stale external autosave echo arrives', async () => {
    let editorInstance: LexicalEditor | null = null;
    let latestEmittedDoc: StudioDocument | null = null;
    const emittedHistory: StudioDocument[] = [];

    const onChange = vi.fn((doc: StudioDocument) => {
      latestEmittedDoc = doc;
      emittedHistory.push(doc);
    });

    const initialDoc = createDefaultStudioDocument('Initial text');

    const { rerender } = render(
      <VibressStudio
        value={initialDoc}
        onChange={onChange}
        onEditorReady={(ed) => {
          editorInstance = ed;
        }}
      />
    );

    expect(editorInstance).not.toBeNull();
    const editor = editorInstance as unknown as LexicalEditor;

    // 1. Local user performs edit 1: "Hello"
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Hello'));
        root.append(p);
      });
    });

    expect(onChange).toHaveBeenCalled();
    const snapshot1 = latestEmittedDoc;
    expect(snapshot1).not.toBeNull();

    // 2. Local user performs edit 2: "Hello world!"
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Hello world!'));
        root.append(p);
      });
    });

    const snapshot2 = latestEmittedDoc;
    expect(snapshot2).not.toBeNull();

    // Verify current editor content is "Hello world!"
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Hello world!');
    });

    // 3. Stale host autosave echo arrives: Host received response for snapshot 1 ("Hello")
    // and re-renders VibressStudio with value={snapshot1}.
    await act(async () => {
      rerender(
        <VibressStudio
          value={snapshot1}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    // CRITICAL INVARIANT: The newer edit "Hello world!" MUST NOT be overwritten by snapshot 1!
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Hello world!');
    });

    // 4. Multiple rapid out-of-order echoes do not cause revert
    await act(async () => {
      rerender(
        <VibressStudio
          value={snapshot1}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Hello world!');
    });

    // 5. Genuine external update arrives from another user / server reload
    const genuineExternalDoc = createDefaultStudioDocument('Completely new external article');
    await act(async () => {
      rerender(
        <VibressStudio
          value={genuineExternalDoc}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    // The genuine external update MUST be applied
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Completely new external article');
    });
  });

  it('handles external synchronization without reset when prop is identical to current state', async () => {
    let editorInstance: LexicalEditor | null = null;
    let latestEmittedDoc: StudioDocument | null = null;

    const onChange = vi.fn((doc: StudioDocument) => {
      latestEmittedDoc = doc;
    });

    const initialDoc = createDefaultStudioDocument('Stable content');

    const { rerender } = render(
      <VibressStudio
        value={initialDoc}
        onChange={onChange}
        onEditorReady={(ed) => {
          editorInstance = ed;
        }}
      />
    );

    expect(editorInstance).not.toBeNull();
    const editor = editorInstance as unknown as LexicalEditor;

    // Typing to trigger an onChange
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Edited content'));
        root.append(p);
      });
    });

    expect(latestEmittedDoc).not.toBeNull();

    // Rerendering with the exact current snapshot
    await act(async () => {
      rerender(
        <VibressStudio
          value={latestEmittedDoc}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Edited content');
    });
  });
});
