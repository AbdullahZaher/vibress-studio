import {
  $getSelection,
  $isRangeSelection,
  $getNodeByKey,
  $isElementNode,
  $isRootOrShadowRoot,
  $createParagraphNode,
  ElementNode,
  LexicalNode,
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

/** Refuse transforms that would invalidate nested list structure or reorder content.
 * This predicate is also used by toolbars before dismissing their menus. */
function restrictionForNode(node: LexicalNode, type: TurnIntoType): string | null {
  if (type === 'bullet-list' || type === 'number-list' || type === 'check-list') return null;
  let current: LexicalNode | null = node;
  while (current && !$isListItemNode(current)) current = current.getParent();
  if (!$isListItemNode(current)) return null;
  const parent = current.getParent();
  if (!$isListNode(parent)) return null;
  if (!$isRootOrShadowRoot(parent.getParent())) {
    return 'Cannot transform a nested list item directly. Outdent it before changing its block type.';
  }
  // ListNode children must remain in a ListNode; nested lists are extracted
  // to adjacent root blocks. Interleaved inline content would change order.
  let encounteredNestedList = false;
  for (const child of current.getChildren()) {
    if ($isListNode(child)) encounteredNestedList = true;
    else if (encounteredNestedList) {
      return 'Cannot transform an item with content after a nested list without reordering it.';
    }
  }
  return null;
}

/** Read-only preflight so unsupported choices show actionable feedback. */
export function getBlockTransformRestriction(
  editor: LexicalEditor,
  type: TurnIntoType,
  targetNodeKey?: string,
): string | null {
  let reason: string | null = null;
  editor.getEditorState().read(() => {
    const node = targetNodeKey
      ? $getNodeByKey(targetNodeKey)
      : (() => {
          const selection = $getSelection();
          return $isRangeSelection(selection) ? selection.anchor.getNode() : null;
        })();
    reason = node ? restrictionForNode(node, type) : 'Select a block before changing its type.';
  });
  return reason;
}

function applyBlockType(type: TurnIntoType, onRejected?: (reason: string) => void) {
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
  const rejection = restrictionForNode(anchorNode, type);
  if (rejection) {
    onRejected?.(rejection);
    return;
  }
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
    // Preserve both the inline content and trailing nested sublists.
    // Nested lists cannot be direct children of paragraph/heading/quote/code.
    const nestedLists: ListNode[] = [];
    for (const child of currentListItem.getChildren()) {
      if ($isListNode(child)) nestedLists.push(child);
      else targetNode.append(child);
    }
    targetNode.setDirection(currentListItem.getDirection());
    const formats = ['', 'left', 'center', 'right', 'justify', 'start', 'end'] as const;
    targetNode.setFormat(formats[currentListItem.getFormat()] ?? '');
    const preceding = currentListItem.getPreviousSiblings();
    const following = currentListItem.getNextSiblings();
    if (following.length > 0) {
      const trailingList = $createListNode(
        currentList.getListType(),
        currentList.getStart() + preceding.length + 1,
      );
      trailingList.setDirection(currentList.getDirection());
      for (const sibling of following) trailingList.append(sibling);
      currentList.insertAfter(trailingList);
    }
    if (preceding.length > 0) currentList.insertAfter(targetNode);
    else currentList.insertBefore(targetNode);

    let previous: ElementNode = targetNode;
    for (const nestedList of nestedLists) {
      previous.insertAfter(nestedList);
      previous = nestedList;
    }
    currentListItem.remove();
    if (currentList.getChildrenSize() === 0) currentList.remove();
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
  onRejected?: (reason: string) => void,
): void {
  editor.update(
    () => {
      if (targetNodeKey) {
        const node = $getNodeByKey(targetNodeKey);
        if (!node) {
          onRejected?.('The selected block is no longer available.');
          return;
        }
        const restriction = restrictionForNode(node, type);
        if (restriction) {
          // Rejection must not even move the selection to the target.
          onRejected?.(restriction);
          return;
        }
        if (
          'select' in node &&
          typeof (node as { select?: () => void }).select === 'function'
        ) {
          (node as { select: () => void }).select();
        }
      }
      applyBlockType(type, onRejected);
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
