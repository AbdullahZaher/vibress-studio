import { isSafeUrl } from '@vibress/studio-utils';

/** Only HTTP(S) bookmark links are navigable in the authoring surface. */
export function parseSafeBookmarkUrl(input: unknown): { href: string; hostname: string } | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return null;
  try {
    const url = new URL(input.trim());
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname) return null;
    return { href: url.href, hostname: url.hostname };
  } catch {
    return null;
  }
}

/** External images should not load executable or session-only URL schemes. */
export function isSafeBookmarkImageUrl(input: unknown): input is string {
  if (typeof input !== 'string' || !input.trim() || !isSafeUrl(input)) return false;
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return false;
  const trimmed = input.trim();
  if (trimmed.startsWith('#') || /^(?:data|blob|mailto|tel):/i.test(trimmed)) return false;
  if (/^[a-z][\w+.-]*:/i.test(trimmed)) return parseSafeBookmarkUrl(trimmed) !== null;
  return true;
}
