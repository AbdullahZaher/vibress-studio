import { getEmbedProvider } from '@vibress/studio-utils';

export type StudioEmbedDestination =
  | { kind: 'iframe'; url: string }
  | { kind: 'external-link'; url: string }
  | { kind: 'invalid' };

/** Keep the interactive preview's iframe policy identical to published HTML. */
export function resolveStudioEmbedDestination(input: unknown): StudioEmbedDestination {
  if (typeof input !== 'string' || !input.trim()) return { kind: 'invalid' };
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return { kind: 'invalid' };

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { kind: 'invalid' };
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
    return { kind: 'invalid' };
  }

  const provider = getEmbedProvider(url.href);
  if (provider) return { kind: 'iframe', url: provider.embedUrl };

  // Unknown providers should remain clickable external links, not iframes.
  return { kind: 'external-link', url: url.href };
}
