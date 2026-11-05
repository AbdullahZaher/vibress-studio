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

  it('allows intentional external revision restoration from B back to A via revisionId prop (Finding 1)', async () => {
    let editorInstance: LexicalEditor | null = null;
    let latestEmittedDoc: StudioDocument | null = null;

    const onChange = vi.fn((doc: StudioDocument) => {
      latestEmittedDoc = doc;
    });

    const initialDoc = createDefaultStudioDocument('Initial');

    const { rerender } = render(
      <VibressStudio
        value={initialDoc}
        revisionId="rev-0"
        onChange={onChange}
        onEditorReady={(ed) => {
          editorInstance = ed;
        }}
      />
    );

    const editor = editorInstance as unknown as LexicalEditor;

    // 1. Edit to A
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Revision A Content'));
        root.append(p);
      });
    });

    const docA = latestEmittedDoc;
    expect(docA).not.toBeNull();

    // 2. Edit to B
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Revision B Content'));
        root.append(p);
      });
    });

    const docB = latestEmittedDoc;
    expect(docB).not.toBeNull();

    // Editor is at Revision B
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Revision B Content');
    });

    // 3. Stale autosave echo for A arrives without new revisionId -> ignored
    await act(async () => {
      rerender(
        <VibressStudio
          value={docA}
          revisionId="rev-0"
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Revision B Content');
    });

    // 4. Intentional revision restoration: Host explicitly passes new revisionId="rev-restore-A"
    await act(async () => {
      rerender(
        <VibressStudio
          value={docA}
          revisionId="rev-restore-A"
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    // CRITICAL: The intentional restoration MUST be applied!
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Revision A Content');
    });
  });

  it('allows intentional external restoration via document.revisionId property', async () => {
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

    // Edit 1
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Original Version'));
        root.append(p);
      });
    });
    const docOriginal = latestEmittedDoc;

    // Edit 2
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const p = $createParagraphNode();
        p.append($createTextNode('Modified Version'));
        root.append(p);
      });
    });

    expect(docOriginal).not.toBeNull();

    // Intentional restoration by attaching revisionId to document object
    const restoredDoc = {
      ...(docOriginal as unknown as StudioDocument),
      revisionId: 'restore-tx-99',
    };

    await act(async () => {
      rerender(
        <VibressStudio
          value={restoredDoc}
          onChange={onChange}
          onEditorReady={(ed) => {
            editorInstance = ed;
          }}
        />
      );
    });

    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('Original Version');
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

  it('evicts oldest entries from emitted snapshots history when size exceeds 50', async () => {
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

    // Since edit1Doc was pushed 52 edits ago, it has been evicted from the 50-item cache.
    // If edit1Doc arrives now without revisionId, it is treated as a new external document
    // because it is no longer in the bounded history!
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
      expect($getRoot().getTextContent()).toBe('Edit 1');
    });
  });
});
