import { describe, it, expect } from 'vitest';
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
} from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { CodeNode } from '@lexical/code';
import { ListNode, ListItemNode } from '@lexical/list';
import { turnSelectedBlockInto } from '../plugins/TurnIntoHelper';

describe('turnSelectedBlockInto helper', () => {
  function setupEditor() {
    const editor = createEditor({
      nodes: [HeadingNode, QuoteNode, CodeNode, ListNode, ListItemNode],
    });
    const rootElement = document.createElement('div');
    rootElement.contentEditable = 'true';
    document.body.appendChild(rootElement);
    editor.setRootElement(rootElement);
    return { editor, rootElement };
  }

  it('transforms paragraph to heading, quote, code, and lists', () => {
    const { editor, rootElement } = setupEditor();
    let targetKey = '';

    // 1. Paragraph -> H1
    editor.update(
      () => {
        const root = $getRoot();
        const p = $createParagraphNode();
        const text = $createTextNode('Hello World');
        p.append(text);
        root.append(p);
        targetKey = p.getKey();
        text.select(0, 5);
      },
      { discrete: true }
    );

    turnSelectedBlockInto(editor, 'h1', targetKey);

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const first = root.getFirstChild();
      expect($isElementNode(first)).toBe(true);
      expect(first?.getType()).toBe('heading');
      expect((first as HeadingNode)?.getTag()).toBe('h1');
      expect(first?.getTextContent()).toBe('Hello World');
      if (first) targetKey = first.getKey();
    });

    // 2. H1 -> Quote
    turnSelectedBlockInto(editor, 'quote', targetKey);

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const first = root.getFirstChild();
      expect($isElementNode(first)).toBe(true);
      expect(first?.getType()).toBe('quote');
      expect(first?.getTextContent()).toBe('Hello World');
      if (first) targetKey = first.getKey();
    });

    // 3. Quote -> Code
    turnSelectedBlockInto(editor, 'code', targetKey);

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const first = root.getFirstChild();
      expect($isElementNode(first)).toBe(true);
      expect(first?.getType()).toBe('code');
      expect(first?.getTextContent()).toBe('Hello World');
      if (first) targetKey = first.getKey();
    });

    // 4. Code -> Bullet list
    turnSelectedBlockInto(editor, 'bullet-list', targetKey);

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const first = root.getFirstChild();
      expect($isElementNode(first)).toBe(true);
      expect(first?.getType()).toBe('list');
      expect(first?.getTextContent()).toBe('Hello World');
      if (first) targetKey = first.getKey();
    });

    // 5. Bullet list -> Paragraph
    turnSelectedBlockInto(editor, 'paragraph', targetKey);

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const first = root.getFirstChild();
      expect($isElementNode(first)).toBe(true);
      expect(first?.getType()).toBe('paragraph');
      expect(first?.getTextContent()).toBe('Hello World');
    });

    rootElement.remove();
  });
});
