import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { LexicalEditor, $getRoot, $createParagraphNode, $createTextNode, UNDO_COMMAND } from 'lexical';
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

    // No explicit replacement ID: protect local content.
    await act(async () => {
      rerender(<VibressStudio value={genuineExternalDoc} onChange={onChange}
        onEditorReady={(ed) => { editorInstance = ed; }} />);
    });
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Hello world!');
    });

    // The host deliberately switches documents with a new replacement token.
    await act(async () => {
      rerender(<VibressStudio value={genuineExternalDoc} replacementId="external-article-1"
        onChange={onChange} onEditorReady={(ed) => { editorInstance = ed; }} />);
    });
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

  it('does not treat changing autosave revisionId as permission to overwrite local work', async () => {
    let editorInstance: LexicalEditor | null = null;
    const snapshots: StudioDocument[] = [];
    const onChange = vi.fn((doc: StudioDocument) => snapshots.push(doc));
    const { rerender } = render(
      <VibressStudio value={createDefaultStudioDocument('Initial')} revisionId={1}
        onChange={onChange} onEditorReady={(ed) => { editorInstance = ed; }} />
    );
    const editor = editorInstance as unknown as LexicalEditor;
    for (const text of ['Edit A', 'Edit B']) {
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          root.append($createParagraphNode().append($createTextNode(text)));
        });
      });
    }
    const stale = snapshots.find((doc) =>
      JSON.stringify(doc.root).includes('Edit A')
    );
    expect(stale).toBeDefined();

    // Host increments the persisted revision on an old save acknowledgment.
    await act(async () => {
      rerender(<VibressStudio value={stale} revisionId={2}
        onChange={onChange} onEditorReady={(ed) => { editorInstance = ed; }} />);
    });
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Edit B');
    });

    // A controlled document restore requires a *separate* explicit token.
    await act(async () => {
      rerender(<VibressStudio value={stale} revisionId={3} replacementId="restore-a"
        onChange={onChange} onEditorReady={(ed) => { editorInstance = ed; }} />);
    });
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Edit A');
    });
  });

  it('does not permit document.revisionId metadata to authorize a destructive restore', async () => {
    let editorInstance: LexicalEditor | null = null;
    const initialDoc = createDefaultStudioDocument('Loaded');
    const onChange = vi.fn();
    const { rerender } = render(
      <VibressStudio value={initialDoc} onChange={onChange}
        onEditorReady={(ed) => { editorInstance = ed; }} />
    );
    const editor = editorInstance as unknown as LexicalEditor;
    await act(async () => {
      editor.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('Unsaved draft')));
      });
    });
    const oldWithNewRevision = { ...initialDoc, revisionId: 78 };
    await act(async () => {
      rerender(<VibressStudio value={oldWithNewRevision} onChange={onChange}
        onEditorReady={(ed) => { editorInstance = ed; }} />);
    });
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Unsaved draft');
    });
  });

  it('applies genuinely new external documents before the author edits', async () => {
    let editorInstance: LexicalEditor | null = null;
    const onChange = vi.fn();
    const { rerender } = render(
      <VibressStudio value={createDefaultStudioDocument('First')} onChange={onChange}
        onEditorReady={(ed) => { editorInstance = ed; }} />
    );
    const editor = editorInstance as unknown as LexicalEditor;
    await act(async () => {
      rerender(<VibressStudio value={createDefaultStudioDocument('Server update')} onChange={onChange}
        onEditorReady={(ed) => { editorInstance = ed; }} />);
    });
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Server update');
    });
  });

  it('preserves undo stack when a stale echo is ignored', async () => {
    let editorInstance: LexicalEditor | null = null;
    let _latestEmittedDoc: StudioDocument | null = null;

    const onChange = vi.fn((doc: StudioDocument) => {
      _latestEmittedDoc = doc;
    });

    const initialDoc = createDefaultStudioDocument('Sentence 1.');

    const { rerender } = render(
      <VibressStudio
        value={initialDoc}
        onChange={onChange}
        onEditorReady={(ed) => {
          editorInstance = ed;
        }}
      />
    );

    const editor = editorInstance as unknown as LexicalEditor;

    // Local edit: append text
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        const p = root.getFirstChild();
        if (p) {
          const t = $createTextNode(' Sentence 2.');
          (p as unknown as { append: (...nodes: unknown[]) => void }).append(t);
        }
      });
    });

    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Sentence 1. Sentence 2.');
    });

    // Stale echo of initialDoc arrives (from earlier autosave)
    await act(async () => {
      rerender(
        <VibressStudio
          value={initialDoc}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    // Stale echo is ignored, content is still full
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Sentence 1. Sentence 2.');
    });

    // User triggers UNDO command
    await act(async () => {
      editor.dispatchCommand(UNDO_COMMAND, undefined);
    });

    // Verify undo succeeded back to "Sentence 1." because history stack was preserved!
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Sentence 1.');
    });
  });

  it('does not trigger unnecessary onChange loop when parent echoes identical value', async () => {
    let editorInstance: LexicalEditor | null = null;
    let latestEmittedDoc: StudioDocument | null = null;

    const onChange = vi.fn((doc: StudioDocument) => {
      latestEmittedDoc = doc;
    });

    const initialDoc = createDefaultStudioDocument('Initial loop test');

    const { rerender } = render(
      <VibressStudio
        value={initialDoc}
        onChange={onChange}
        onEditorReady={(ed) => {
          editorInstance = ed;
        }}
      />
    );

    const editor = editorInstance as unknown as LexicalEditor;

    // Clear onChange calls from initial mount if any
    onChange.mockClear();

    // User types "Edit"
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Edit'));
        root.append(p);
      });
    });

    // onChange was called exactly once for the user's edit
    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = latestEmittedDoc;
    expect(emitted).not.toBeNull();

    // Controlled component echoes emitted value back
    await act(async () => {
      rerender(
        <VibressStudio
          value={emitted}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    // MUST NOT trigger onChange again!
    expect(onChange).toHaveBeenCalledTimes(1);

    // Another echo rerender
    await act(async () => {
      rerender(
        <VibressStudio
          value={emitted}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('preserves newer content even when an autosave echo arrives after more than 50 edits', async () => {
    let editorInstance: LexicalEditor | null = null;
    let latestEmittedDoc: StudioDocument | null = null;

    const onChange = vi.fn((doc: StudioDocument) => {
      latestEmittedDoc = doc;
    });

    const initialDoc = createDefaultStudioDocument('Initial');

    const { rerender } = render(
      <VibressStudio
        value={initialDoc}
        onChange={onChange}
        onEditorReady={(ed) => {
          editorInstance = ed;
        }}
      />
    );

    const editor = editorInstance as unknown as LexicalEditor;

    // Capture first edit snapshot
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Edit 1'));
        root.append(p);
      });
    });
    const edit1Doc = latestEmittedDoc;

    // Perform 52 more sequential edits to exceed the 50-entry cache bound
    for (let i = 2; i <= 53; i++) {
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const p = $createParagraphNode();
          p.append($createTextNode(`Edit ${i}`));
          root.append(p);
        });
      });
    }

    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Edit 53');
    });

    // History length cannot make old autosave content an authorized external replacement.
    // An old echo remains untrusted after any number of local edits.
    await act(async () => {
      rerender(
        <VibressStudio
          value={edit1Doc}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Edit 53');
    });
  });
});
