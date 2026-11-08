import { describe, expect, it } from 'vitest';
import { $createTextNode, $getRoot, $getSelection, $isRangeSelection, createEditor } from 'lexical';
import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { CodeNode } from '@lexical/code';
import { getBlockTransformRestriction, turnNodeInto, type TurnIntoType } from '../plugins/TurnIntoHelper';

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
      const nested = (outer.getFirstChild() as ListItemNode).getLastChild();
      expect(nested?.getType()).toBe('list');
    });
  });
  it.each(['paragraph', 'h2', 'quote', 'code'] as const)(
    'moves nested list into a valid adjacent block when converting its parent to %s',
    (target) => {
      const editor = createListEditor();
      let parentKey = '';
      editor.update(() => {
        const list = $createListNode('number', 7);
        list.setDirection('rtl');
        const parent = $createListItemNode().append($createTextNode('Parent Arabic عربي'));
        parentKey = parent.getKey();
        const nested = $createListNode('bullet');
        nested.append($createListItemNode().append($createTextNode('Nested A')));
        nested.append($createListItemNode().append($createTextNode('Nested B')));
        parent.append(nested);
        list.append(parent, $createListItemNode().append($createTextNode('Next')));
        $getRoot().append(list);
      }, { discrete: true });
      expect(getBlockTransformRestriction(editor, target, parentKey)).toBeNull();
      turnNodeInto(editor, parentKey, target);
      editor.getEditorState().read(() => {
        const blocks = $getRoot().getChildren();
        expect(blocks.map(block => block.getType())).toEqual([
          target === 'h2' ? 'heading' : target, 'list', 'list',
        ]);
        expect(blocks[0]?.getTextContent()).toBe('Parent Arabic عربي');
        const nested = blocks[1] as ListNode;
        expect(nested.getListType()).toBe('bullet');
        expect(nested.getChildren().map(child => child.getTextContent())).toEqual(['Nested A', 'Nested B']);
        const trailing = blocks[2] as ListNode;
        expect(trailing.getListType()).toBe('number');
        expect(trailing.getStart()).toBe(8);
        expect(trailing.getChildren().map(child => child.getTextContent())).toEqual(['Next']);
        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        if ($isRangeSelection(selection)) {
          expect(selection.anchor.getNode().getTextContent()).toContain('Parent Arabic عربي');
        }
      });
      const saved = editor.getEditorState().toJSON();
      const restored = editor.parseEditorState(JSON.stringify(saved)).toJSON();
      expect(restored.root.children).toEqual(saved.root.children);
    },
  );

  it.each([0, 1, 2])('preserves custom ordered start 9 across position %s', (position) => {
    const editor = createListEditor();
    const keys: string[] = [];
    editor.update(() => {
      const list = $createListNode('number', 9);
      list.setDirection('rtl');
      for (const value of ['الأول', 'Second', 'الثالث']) {
        const item = $createListItemNode().append($createTextNode(value));
        keys.push(item.getKey());
        list.append(item);
      }
      $getRoot().append(list);
    }, { discrete: true });
    turnNodeInto(editor, keys[position]!, 'paragraph');
    editor.getEditorState().read(() => {
      const root = $getRoot().getChildren();
      const before = position > 0 ? root[0] as ListNode : null;
      const after = position < 2 ? root[root.length - 1] as ListNode : null;
      if (before) {
        expect(before.getListType()).toBe('number');
        expect(before.getStart()).toBe(9);
        expect(before.getChildrenSize()).toBe(position);
      }
      if (after) {
        expect(after.getListType()).toBe('number');
        expect(after.getStart()).toBe(10 + position);
        expect(after.getChildrenSize()).toBe(2 - position);
      }
      const readable = root.flatMap(block => block.getType() === 'list'
        ? (block as ListNode).getChildren().map(child => child.getTextContent())
        : [block.getTextContent()]);
      expect(readable).toEqual(['الأول', 'Second', 'الثالث']);
    });
  });

  it('rejects transforming nested list item without changing editor state or selection', () => {
    const editor = createListEditor();
    let nestedKey = '';
    editor.update(() => {
      const outer = $createListNode('bullet');
      const parent = $createListItemNode().append($createTextNode('Parent'));
      const inner = $createListNode('bullet');
      const nested = $createListItemNode().append($createTextNode('Child'));
      nestedKey = nested.getKey();
      inner.append(nested);
      parent.append(inner);
      outer.append(parent);
      $getRoot().append(outer);
      nested.select(0, 0);
    }, { discrete: true });
    const before = editor.getEditorState().toJSON();
    let selectedTextBefore = '';
    let hadRangeBefore = false;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      hadRangeBefore = $isRangeSelection(selection);
      if ($isRangeSelection(selection)) selectedTextBefore = selection.anchor.getNode().getTextContent();
    });
    expect(getBlockTransformRestriction(editor, 'h2', nestedKey)).toMatch(/nested list/i);
    turnNodeInto(editor, nestedKey, 'h2');
    expect(editor.getEditorState().toJSON()).toEqual(before);
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      // A headless editor may have null selection even after selecting an
      // unmounted item. Rejection must preserve the *existing* selection,
      // not synthesize a new range that did not previously exist.
      expect($isRangeSelection(selection)).toBe(hadRangeBefore);
      if ($isRangeSelection(selection)) {
        expect(selection.anchor.getNode().getTextContent()).toBe(selectedTextBefore);
      }
    });
  });

});
