import { describe, expect, it } from 'vitest';
import { createEditor, $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { $createQuoteNode } from '@lexical/rich-text';
import { $createListNode, $createListItemNode } from '@lexical/list';
import { STUDIO_CORE_NODES } from '@vibress/studio-nodes';
import { registerStudioTransforms } from '../index';

describe('Public registerStudioTransforms contract', () => {
  it('preserves text when flattening a nested quote and terminates', () => {
    const editor = createEditor({ nodes: STUDIO_CORE_NODES });
    const unregister = registerStudioTransforms(editor);
    editor.update(() => {
      const outer = $createQuoteNode();
      const inner = $createQuoteNode();
      inner.append($createParagraphNode().append($createTextNode('Nested quote content')));
      outer.append(inner);
      $getRoot().append(outer);
    }, { discrete: true });

    let text = '';
    editor.getEditorState().read(() => { text = $getRoot().getTextContent(); });
    expect(text).toContain('Nested quote content');
    unregister();
  });

  it('does not silently transform valid nested lists or checklist state', () => {
    const editor = createEditor({ nodes: STUDIO_CORE_NODES });
    const unregister = registerStudioTransforms(editor);
    editor.update(() => {
      const outer = $createListNode('check');
      const checked = $createListItemNode();
      checked.setChecked(true);
      checked.append($createTextNode('Arabic العربية'));
      const nested = $createListNode('bullet');
      nested.append($createListItemNode().append($createTextNode('Nested')));
      const wrapping = $createListItemNode();
      wrapping.append(nested);
      outer.append(checked, wrapping);
      $getRoot().append(outer);
    }, { discrete: true });
    const serialized = editor.getEditorState().toJSON();
    const content = JSON.stringify(serialized.root);
    expect(content).toContain('Arabic العربية');
    expect(content).toContain('Nested');
    expect(content).toContain('"checked":true');
    unregister();
  });
});
