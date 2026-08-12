import { StudioDocument, migrateDocument } from '@vibress/studio-core';
import { renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { parseMarkdownToHtml } from '@vibress/studio-utils';

export { parseMarkdownToHtml };

/**
 * Structural view of a studio document node used by the markdown renderer
 * (children are stored as unknown[]; renderers narrow each child to this shape).
 */
interface StudioMarkdownNode {
  type: string;
  text?: string;
  format?: number;
  children?: unknown[];
  url?: string;
  tag?: string;
  cardType?: string;
  cardData?: { markdown?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export function studioDocumentToMarkdown(docInput: unknown): string {
  const doc = migrateDocument(docInput);
  if (!doc.root || !Array.isArray(doc.root.children)) {
    return '';
  }

  return doc.root.children
    .map((node) => renderNodeToMarkdown(node as StudioMarkdownNode))
    .filter(Boolean)
    .join('\n\n');
}

function renderNodeToMarkdown(node: StudioMarkdownNode): string {
  if (!node || typeof node !== 'object') return '';

  const type = node.type;

  if (type === 'text') {
    let text = node.text || '';
    const format = typeof node.format === 'number' ? node.format : 0;
    if (format & 16) text = `\`${text}\``;
    if (format & 1) text = `**${text}**`;
    if (format & 2) text = `*${text}*`;
    if (format & 4) text = `~~${text}~~`;
    return text;
  }

  const renderChildren = () => {
    if (Array.isArray(node.children)) {
      return node.children.map((child) => renderNodeToMarkdown(child as StudioMarkdownNode)).join('');
    }
    return '';
  };

  switch (type) {
    case 'paragraph':
      return renderChildren();

    case 'heading': {
      const tag = (node.tag || 'h2').toLowerCase();
      const hashes = tag === 'h1' ? '#' : tag === 'h2' ? '##' : tag === 'h3' ? '###' : '####';
      return `${hashes} ${renderChildren()}`;
    }

    case 'quote':
      return `> ${renderChildren()}`;

    case 'list':
      return renderChildren();

    case 'listitem':
      return `- ${renderChildren()}`;

    case 'link':
      return `[${renderChildren()}](${node.url || '#'})`;

    case 'code':
      return `\`\`\`\n${renderChildren()}\n\`\`\``;

    case 'studio-card': {
      if (node.cardType === 'divider') return '---';
      if (node.cardType === 'markdown') return node.cardData?.markdown || '';
      return `[Card: ${node.cardType}]`;
    }

    default:
      return renderChildren();
  }
}
