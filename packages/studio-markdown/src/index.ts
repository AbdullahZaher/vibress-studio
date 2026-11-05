import { migrateDocument } from '@vibress/studio-core';
import { parseMarkdownToHtml, isSafeUrl } from '@vibress/studio-utils';

export { parseMarkdownToHtml };

export function escapeMarkdownLabel(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

export function escapeMarkdownUrl(url: unknown): string {
  if (typeof url !== 'string' || !isSafeUrl(url)) {
    return '#';
  }
  const trimmed = url.trim();
  return trimmed
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/ /g, '%20')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function studioDocumentToMarkdown(docInput: unknown): string {
  const doc = migrateDocument(docInput);
  if (!doc.root || !Array.isArray(doc.root.children)) {
    return '';
  }

  return doc.root.children
    .map((node: unknown) => renderNodeToMarkdown(node))
    .filter(Boolean)
    .join('\n\n');
}

function renderNodeToMarkdown(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as {
    type?: string;
    text?: string;
    format?: number;
    children?: unknown[];
    tag?: string;
    listType?: string;
    url?: string;
    cardType?: string;
    cardData?: Record<string, unknown>;
  } & Record<string, unknown>;

  const type = n.type;

  if (type === 'text') {
    let text = n.text || '';
    const format = typeof n.format === 'number' ? n.format : 0;
    if (format & 16) text = `\`${text}\``;
    if (format & 1) text = `**${text}**`;
    if (format & 2) text = `*${text}*`;
    if (format & 4) text = `~~${text}~~`;
    return text;
  }

  const renderChildren = () => {
    if (Array.isArray(n.children)) {
      return n.children.map((child: unknown) => renderNodeToMarkdown(child)).join('');
    }
    return '';
  };

  switch (type) {
    case 'paragraph':
      return renderChildren();

    case 'heading': {
      const tag = (n.tag || 'h2').toLowerCase();
      const hashes = tag === 'h1' ? '#' : tag === 'h2' ? '##' : tag === 'h3' ? '###' : '####';
      return `${hashes} ${renderChildren()}`;
    }

    case 'quote':
      return `> ${renderChildren()}`;

    case 'list': {
      const isNumbered = n.listType === 'number';
      if (Array.isArray(n.children)) {
        return n.children
          .map((child: unknown, idx: number) => {
            if (isNumbered && child && typeof child === 'object') {
              const item = child as { children?: unknown[] };
              const itemContent = Array.isArray(item.children)
                ? item.children.map((c: unknown) => renderNodeToMarkdown(c)).join('')
                : '';
              return `${idx + 1}. ${itemContent}`;
            }
            return renderNodeToMarkdown(child);
          })
          .join('\n');
      }
      return '';
    }

    case 'listitem':
      return `- ${renderChildren()}`;

    case 'link': {
      const label = renderChildren();
      const safeUrl = escapeMarkdownUrl(n.url);
      const escapedLabel = escapeMarkdownLabel(label);
      return `[${escapedLabel}](${safeUrl})`;
    }

    case 'code':
      return `\`\`\`\n${renderChildren()}\n\`\`\``;

    case 'studio-card': {
      if (n.cardType === 'divider') return '---';
      if (n.cardType === 'markdown') return (n.cardData?.markdown as string | undefined) || '';
      if (n.cardType === 'image') {
        const rawSrc = n.cardData?.src;
        const safeSrc = escapeMarkdownUrl(rawSrc);
        const alt = escapeMarkdownLabel(typeof n.cardData?.alt === 'string' ? n.cardData.alt : '');
        if (safeSrc && safeSrc !== '#') {
          return `![${alt}](${safeSrc})`;
        }
        return `[Card: image]`;
      }
      if (n.cardType === 'button') {
        const text = escapeMarkdownLabel(typeof n.cardData?.text === 'string' ? n.cardData.text : 'Button');
        const url = escapeMarkdownUrl(n.cardData?.url);
        return `[${text}](${url})`;
      }
      return `[Card: ${n.cardType}]`;
    }

    default:
      return renderChildren();
  }
}
