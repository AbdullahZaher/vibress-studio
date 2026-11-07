import {
  $getSelection,
  $isRangeSelection,
  $getNodeByKey,
  $isElementNode,
  $isRootOrShadowRoot,
  $createParagraphNode,
  ElementNode,
  LexicalEditor,
} from 'lexical';
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingTagType,
} from '@lexical/rich-text';
import {
  $createListNode,
  $createListItemNode,
  $isListNode,
  $isListItemNode,
  ListNode,
  ListItemNode,
} from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { $setBlocksType } from '@lexical/selection';

export type TurnIntoType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet-list'
  | 'number-list'
  | 'check-list'
  | 'quote'
  | 'code';

function applyBlockType(type: TurnIntoType) {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return;
  }

  const isListType =
    type === 'bullet-list' || type === 'number-list' || type === 'check-list';
  const targetListType =
    type === 'bullet-list'
      ? 'bullet'
      : type === 'number-list'
      ? 'number'
      : 'check';

  const anchorNode = selection.anchor.getNode();
  const currentListItem = $isListItemNode(anchorNode)
    ? anchorNode
    : $isListItemNode(anchorNode.getParent())
    ? (anchorNode.getParent() as ListItemNode)
    : null;
  const currentList = currentListItem
    ? (currentListItem.getParent() as ListNode)
    : $isListNode(anchorNode)
    ? anchorNode
    : $isListNode(anchorNode.getParent())
    ? (anchorNode.getParent() as ListNode)
    : null;

  if (isListType) {
    if (currentList && $isListNode(currentList)) {
      currentList.setListType(targetListType);
      return;
    }
    const element = $isElementNode(anchorNode)
      ? anchorNode
      : anchorNode.getParent();
    if (element && !$isRootOrShadowRoot(element)) {
      const list = $createListNode(targetListType);
      const listItem = $createListItemNode();
      const children = element.getChildren();
      for (const child of children) {
        listItem.append(child);
      }
      list.append(listItem);
      element.replace(list);
      listItem.select();
      return;
    }
    const list = $createListNode(targetListType);
    const listItem = $createListItemNode();
    list.append(listItem);
    selection.insertNodes([list]);
    listItem.select();
    return;
  }

  if (currentListItem && currentList && $isListNode(currentList)) {
    // A ListNode may contain only ListItemNodes. Inserting a paragraph,
    // heading, quote or code directly into it creates an invalid tree.
    // Nested lists have a different ownership structure: preserve them
    // unchanged rather than moving their children into an invalid hierarchy.
    if (!$isRootOrShadowRoot(currentList.getParent())) {
      return;
    }

    let targetNode: ElementNode;
    switch (type) {
      case 'paragraph':
        targetNode = $createParagraphNode();
        break;
      case 'h1':
      case 'h2':
      case 'h3':
        targetNode = $createHeadingNode(type as HeadingTagType);
        break;
      case 'quote':
        targetNode = $createQuoteNode();
        break;
      case 'code':
        targetNode = $createCodeNode();
        break;
      default:
        targetNode = $createParagraphNode();
    }
    for (const child of currentListItem.getChildren()) {
      targetNode.append(child);
    }
    const preceding = currentListItem.getPreviousSiblings();
    const following = currentListItem.getNextSiblings();
    if (following.length > 0) {
      const trailingList = $createListNode(
        currentList.getListType(),
        currentList.getStart() + preceding.length + 1,
      );
      for (const sibling of following) trailingList.append(sibling);
      currentList.insertAfter(trailingList);
    }

    if (preceding.length > 0) {
      currentList.insertAfter(targetNode);
      currentListItem.remove();
    } else if (following.length > 0) {
      currentList.insertBefore(targetNode);
      currentListItem.remove();
      currentList.remove();
    } else {
      currentList.replace(targetNode);
    }
    targetNode.select();
    return;
  }

  switch (type) {
    case 'paragraph': {
      $setBlocksType(selection, () => $createParagraphNode());
      break;
    }
    case 'h1':
    case 'h2':
    case 'h3': {
      const tag = type as HeadingTagType;
      $setBlocksType(selection, () => $createHeadingNode(tag));
      break;
    }
    case 'quote': {
      $setBlocksType(selection, () => $createQuoteNode());
      break;
    }
    case 'code': {
      $setBlocksType(selection, () => $createCodeNode());
      break;
    }
  }
}

export function turnSelectedBlockInto(
  editor: LexicalEditor,
  type: TurnIntoType,
  targetNodeKey?: string,
): void {
  editor.update(
    () => {
      if (targetNodeKey) {
        const node = $getNodeByKey(targetNodeKey);
        if (
          node &&
          'select' in node &&
          typeof (node as { select?: () => void }).select === 'function'
        ) {
          (node as { select: () => void }).select();
        }
      }
      applyBlockType(type);
    },
    { discrete: true },
  );
}

export function turnNodeInto(
  editor: LexicalEditor,
  nodeKey: string,
  type: TurnIntoType,
): void {
  turnSelectedBlockInto(editor, type, nodeKey);
}
