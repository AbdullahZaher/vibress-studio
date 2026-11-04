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

    case 'listitem': {
      if (typeof n.checked === 'boolean') {
        const check = n.checked ? '[x]' : '[ ]';
        return `- ${check} ${renderChildren()}`;
      }
      return `- ${renderChildren()}`;
    }

    case 'table': {
      if (!Array.isArray(n.children) || n.children.length === 0) return '';
      const rows = n.children as Array<{ type?: string; children?: unknown[] }>;
      const renderedRows: string[][] = [];

      for (const row of rows) {
        if (!row || !Array.isArray(row.children)) continue;
        const cells = row.children as Array<{ type?: string; children?: unknown[] }>;
        const rowCells = cells.map((cell) => {
          const content = renderNodeToMarkdown(cell).trim().replace(/\n+/g, '<br />').replace(/\|/g, '\\|');
          return content;
        });
        renderedRows.push(rowCells);
      }

      if (renderedRows.length === 0) return '';

      const maxCols = Math.max(...renderedRows.map((r) => r.length), 1);
      const normalizedRows = renderedRows.map((r) => {
        const padded = [...r];
        while (padded.length < maxCols) padded.push('');
        return padded;
      });

      const headerRow = normalizedRows[0];
      if (!headerRow || headerRow.length === 0) return '';
      const headerLine = `| ${headerRow.join(' | ')} |`;
      const delimiterLine = `| ${headerRow.map(() => '---').join(' | ')} |`;
      const dataLines = normalizedRows.slice(1).map((r) => `| ${r.join(' | ')} |`);

      return [headerLine, delimiterLine, ...dataLines].join('\n');
    }

    case 'tablerow':
      return renderChildren();

    case 'tablecell':
      return renderChildren();

    case 'link': {
      const label = renderChildren();
      const safeUrl = escapeMarkdownUrl(n.url);
      const escapedLabel = escapeMarkdownLabel(label);
      return `[${escapedLabel}](${safeUrl})`;
    }

    case 'code': {
      const lang = typeof n.language === 'string' && n.language ? n.language : '';
      return `\`\`\`${lang}\n${renderChildren()}\n\`\`\``;
    }

    case 'studio-card': {
      if (n.cardType === 'divider') return '---';
      if (n.cardType === 'markdown') return (n.cardData?.markdown as string | undefined) || '';
      if (n.cardType === 'html') return (n.cardData?.html as string | undefined) || '';

      if (n.cardType === 'image') {
        const rawSrc = n.cardData?.src;
        const safeSrc = escapeMarkdownUrl(rawSrc);
        const alt = escapeMarkdownLabel(typeof n.cardData?.alt === 'string' ? n.cardData.alt : '');
        const caption = typeof n.cardData?.caption === 'string' && n.cardData.caption.trim() ? n.cardData.caption.trim() : '';
        if (safeSrc && safeSrc !== '#') {
          return caption ? `![${alt}](${safeSrc})\n*${escapeMarkdownLabel(caption)}*` : `![${alt}](${safeSrc})`;
        }
        return `[Card: image]`;
      }

      if (n.cardType === 'gallery') {
        const images = Array.isArray(n.cardData?.images) ? n.cardData.images : [];
        const caption = typeof n.cardData?.caption === 'string' && n.cardData.caption.trim() ? n.cardData.caption.trim() : '';
        const lines: string[] = [];
        for (const img of images) {
          if (img && typeof img === 'object') {
            const raw = img as { src?: string; alt?: string };
            const safeSrc = escapeMarkdownUrl(raw.src);
            const alt = escapeMarkdownLabel(typeof raw.alt === 'string' ? raw.alt : '');
            if (safeSrc && safeSrc !== '#') {
              lines.push(`![${alt}](${safeSrc})`);
            }
          }
        }
        if (caption) {
          lines.push(`*${escapeMarkdownLabel(caption)}*`);
        }
        return lines.length > 0 ? lines.join('\n') : `[Card: gallery]`;
      }

      if (n.cardType === 'video') {
        const rawSrc = n.cardData?.src;
        const safeSrc = escapeMarkdownUrl(rawSrc);
        const caption = typeof n.cardData?.caption === 'string' && n.cardData.caption.trim() ? n.cardData.caption.trim() : 'Video';
        if (safeSrc && safeSrc !== '#') {
          return `[▶ ${escapeMarkdownLabel(caption)}](${safeSrc})`;
        }
        return `[Card: video]`;
      }

      if (n.cardType === 'audio') {
        const rawSrc = n.cardData?.src;
        const safeSrc = escapeMarkdownUrl(rawSrc);
        const title = typeof n.cardData?.title === 'string' && n.cardData.title.trim()
          ? n.cardData.title.trim()
          : (typeof n.cardData?.caption === 'string' && n.cardData.caption.trim() ? n.cardData.caption.trim() : 'Audio track');
        if (safeSrc && safeSrc !== '#') {
          return `[🎵 ${escapeMarkdownLabel(title)}](${safeSrc})`;
        }
        return `[Card: audio]`;
      }

      if (n.cardType === 'file') {
        const rawSrc = n.cardData?.src;
        const safeSrc = escapeMarkdownUrl(rawSrc);
        const title = typeof n.cardData?.title === 'string' && n.cardData.title.trim()
          ? n.cardData.title.trim()
          : 'Download file';
        if (safeSrc && safeSrc !== '#') {
          return `[📎 ${escapeMarkdownLabel(title)}](${safeSrc})`;
        }
        return `[Card: file]`;
      }

      if (n.cardType === 'button') {
        const text = escapeMarkdownLabel(typeof n.cardData?.text === 'string' ? n.cardData.text : 'Button');
        const url = escapeMarkdownUrl(n.cardData?.url);
        return `[${text}](${url})`;
      }

      if (n.cardType === 'bookmark') {
        const rawUrl = n.cardData?.url;
        const safeUrl = escapeMarkdownUrl(rawUrl);
        const title = typeof n.cardData?.title === 'string' && n.cardData.title.trim()
          ? n.cardData.title.trim()
          : (typeof rawUrl === 'string' ? rawUrl : 'Bookmark');
        const description = typeof n.cardData?.description === 'string' && n.cardData.description.trim()
          ? n.cardData.description.trim()
          : '';
        if (safeUrl && safeUrl !== '#') {
          const link = `[${escapeMarkdownLabel(title)}](${safeUrl})`;
          return description ? `${link}\n> ${escapeMarkdownLabel(description)}` : link;
        }
        return `[Card: bookmark]`;
      }

      if (n.cardType === 'callout') {
        const text = typeof n.cardData?.text === 'string'
          ? n.cardData.text.trim()
          : (typeof n.cardData?.message === 'string' ? n.cardData.message.trim() : '');
        const emoji = typeof n.cardData?.emoji === 'string' && n.cardData.emoji ? `${n.cardData.emoji} ` : '';
        if (text) {
          const formatted = text.split('\n').map((line) => `> ${emoji}${line}`).join('\n');
          return formatted;
        }
        return `[Card: callout]`;
      }

      if (n.cardType === 'toggle') {
        const title = typeof n.cardData?.title === 'string' ? n.cardData.title : 'Details';
        const content = typeof n.cardData?.content === 'string' ? n.cardData.content : '';
        return `<details><summary>${escapeMarkdownLabel(title)}</summary>\n\n${content}\n\n</details>`;
      }

      if (n.cardType === 'embed') {
        const rawUrl = n.cardData?.url;
        const safeUrl = escapeMarkdownUrl(rawUrl);
        const caption = typeof n.cardData?.caption === 'string' && n.cardData.caption.trim() ? n.cardData.caption.trim() : '';
        if (safeUrl && safeUrl !== '#') {
          const label = caption || `Embed: ${safeUrl}`;
          return `[${escapeMarkdownLabel(label)}](${safeUrl})`;
        }
        return `[Card: embed]`;
      }

      return `[Card: ${n.cardType}]`;
    }

    default:
      return renderChildren();
  }
}
