import { describe, expect, it } from 'vitest';
import { $createTextNode, $getRoot, createEditor } from 'lexical';
import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { CodeNode } from '@lexical/code';
import { turnNodeInto, type TurnIntoType } from '../plugins/TurnIntoHelper';

function createListEditor() {
  return createEditor({
    nodes: [HeadingNode, QuoteNode, CodeNode, ListNode, ListItemNode],
    onError: (error) => { throw error; },
  });
}

describe('multi-item list block transformation (Beta content integrity)', () => {
  it.each([
    { position: 0, target: 'paragraph' as TurnIntoType, expectedTypes: ['paragraph', 'list'] },
    { position: 1, target: 'h2' as TurnIntoType, expectedTypes: ['list', 'heading', 'list'] },
    { position: 2, target: 'quote' as TurnIntoType, expectedTypes: ['list', 'quote'] },
    { position: 1, target: 'code' as TurnIntoType, expectedTypes: ['list', 'code', 'list'] },
  ])('preserves all items when converting position $position to $target', ({ position, target, expectedTypes }) => {
    const editor = createListEditor();
    const keys: string[] = [];
    editor.update(() => {
      const list = $createListNode('number');
      for (const label of ['First', 'Middle', 'Last']) {
        const item = $createListItemNode().append($createTextNode(label));
        list.append(item);
        keys.push(item.getKey());
      }
      $getRoot().append(list);
    }, { discrete: true });

    turnNodeInto(editor, keys[position]!, target);
    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map(child => child.getType())).toEqual(expectedTypes);
      const readable = children.flatMap(child =>
        child.getType() === 'list'
          ? (child as ListNode).getChildren().map(item => item.getTextContent())
          : [child.getTextContent()]
      );
      expect(readable).toEqual(['First', 'Middle', 'Last']);
      for (const child of children) {
        if (child.getType() === 'list') {
          expect((child as ListNode).getChildren().every(item => item.getType() === 'listitem')).toBe(true);
        }
      }
    });
    const state = editor.getEditorState().toJSON();
    expect(() => editor.parseEditorState(JSON.stringify(state))).not.toThrow();
  });

  it('keeps nested lists intact rather than inserting an invalid paragraph child', () => {
    const editor = createListEditor();
    let nestedKey = '';
    editor.update(() => {
      const outer = $createListNode('bullet');
      const outerItem = $createListItemNode().append($createTextNode('Parent'));
      const nested = $createListNode('bullet');
      nested.append($createListItemNode().append($createTextNode('Inner A')));
      const selected = $createListItemNode().append($createTextNode('Inner B'));
      nestedKey = selected.getKey();
      nested.append(selected);
      outerItem.append(nested);
      outer.append(outerItem);
      $getRoot().append(outer);
    }, { discrete: true });
    const before = editor.getEditorState().toJSON();
    turnNodeInto(editor, nestedKey, 'quote');
    expect(editor.getEditorState().toJSON().root.children).toEqual(before.root.children);
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toContain('Inner B');
      const outer = $getRoot().getFirstChild() as ListNode;
      expect(outer.getType()).toBe('list');
      const nested = (outer.getFirstChild() as ListItemNode).getChildren().at(-1);
      expect(nested?.getType()).toBe('list');
    });
  });
});
