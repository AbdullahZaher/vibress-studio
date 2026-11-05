/**
 * Card metadata popovers submit the caption alongside unrelated fields such as
 * image alt text or video settings. Preserve the Lexical JSON caption when
 * the submitted value is the unchanged caption displayed in that popover.
 * A real caption edit deliberately replaces it with the author-entered text.
 */
export function captionMetadataPatch(
  current: { caption?: unknown; captionHtml?: unknown },
  submittedCaption: string,
): { caption?: string; captionHtml?: string } {
  const visibleCaption = typeof current.caption === 'string'
    ? current.caption
    : typeof current.captionHtml === 'string'
      ? current.captionHtml
      : '';
  if (submittedCaption === visibleCaption) return {};
  return { caption: submittedCaption, captionHtml: submittedCaption };
}
