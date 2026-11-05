import { LexicalEditor } from 'lexical';
import { QuoteNode, $isQuoteNode } from '@lexical/rich-text';

/**
 * Register only transformations proven to preserve author data.
 *
 * List normalization is deliberately NOT implemented here. The previous
 * ListNode transform detected malformed children but made no changes.
 * Structural list repair belongs to the installed @lexical/list integration;
 * wrapping arbitrary nodes here can discard marks, selection, or nested state.
 */
export function registerStudioTransforms(editor: LexicalEditor): () => void {
  const unregisterQuote = editor.registerNodeTransform(QuoteNode, (node: QuoteNode) => {
    const parent = node.getParent();
    if ($isQuoteNode(parent)) {
      // Preserve each existing child and its serialized fields.
      // The transform terminates because the nested quote is removed.
      for (const child of node.getChildren()) {
        parent.insertBefore(child);
      }
      node.remove();
    }
  });

  return () => { unregisterQuote(); };
}
