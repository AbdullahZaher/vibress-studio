import { $getRoot, $isElementNode, $isTextNode, type ElementFormatType, type LexicalNode } from 'lexical';

const formats: Readonly<Record<string, ElementFormatType>> = {
  '': '', left: 'left', center: 'center', right: 'right', justify: 'justify', start: 'start', end: 'end',
  0: '', 1: 'left', 2: 'center', 3: 'right', 4: 'justify', 5: 'start', 6: 'end',
};

/** Restore legacy numeric formats, missing text defaults, and the inherited
 * element properties omitted by Lexical 0.13 table/row imports. This runs inside
 * parseEditorState's callback, without new node types or a document-format fork. */
export function restoreImportedNodeProperties(serializedRoot: unknown): void {
  function visit(node: LexicalNode, serialized: unknown): void {
    if (!serialized || typeof serialized !== 'object') return;
    const fields = serialized as Record<string, unknown>;
    if ($isTextNode(node)) {
      if (fields.format === undefined) node.setFormat(0);
      if (fields.detail === undefined) node.setDetail(0);
      if (fields.mode === undefined) node.setMode('normal');
      if (fields.style === undefined) node.setStyle('');
      return;
    }
    if (!$isElementNode(node)) return;
    {
      if (fields.direction === 'rtl' || fields.direction === 'ltr' || fields.direction === null) {
        node.setDirection(fields.direction);
      }
      node.setIndent(typeof fields.indent === 'number' ? fields.indent : 0);
      if (typeof fields.format === 'string' || typeof fields.format === 'number') {
        const format = formats[fields.format];
        if (format !== undefined) node.setFormat(format);
      }
    }
    if (!Array.isArray(fields.children)) return;
    const children = node.getChildren();
    fields.children.forEach((child, index) => {
      const imported = children[index];
      if (imported) visit(imported, child);
    });
  }
  visit($getRoot(), serializedRoot);
}

/** The pinned reconciler can clear direction on container-only tables even
 * after import. Match the public renderer's descendant-direction fallback on
 * the fresh JSON snapshot, without mutating persisted input or Lexical state. */
export function preserveSerializedTableDirections<T>(root: T): T {
  const pending: unknown[] = [root];
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object') continue;
    const fields = item as Record<string, unknown>;
    if (!Array.isArray(fields.children)) continue;
    for (const child of fields.children) pending.push(child);
    if (fields.type !== 'table' || fields.direction === 'ltr' || fields.direction === 'rtl') continue;
    const descendants: unknown[] = [...fields.children].reverse();
    while (descendants.length) {
      const descendant = descendants.pop();
      if (!descendant || typeof descendant !== 'object') continue;
      const entry = descendant as Record<string, unknown>;
      if (entry.direction === 'rtl' || entry.direction === 'ltr') {
        fields.direction = entry.direction;
        break;
      }
      if (Array.isArray(entry.children)) descendants.push(...[...entry.children].reverse());
    }
  }
  return root;
}
