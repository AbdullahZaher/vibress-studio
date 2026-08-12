import React from 'react';
import { sanitizeHtmlFragment } from '@vibress/studio-utils';

/**
 * Branded sanitized HTML. Only `sanitizeToSafeHtml` (which runs the
 * allowlist sanitizer) can produce this type; `SafeHtml` refuses anything
 * else. This makes it impossible to render unsanitized HTML in the React
 * preview/editor paths without a type error.
 */
export type SanitizedHtml = {
  readonly __brand: 'SanitizedHtml';
  readonly html: string;
};

/** The ONLY way to create `SanitizedHtml`. Runs the allowlist sanitizer. */
export function sanitizeToSafeHtml(html: string): SanitizedHtml {
  return { __brand: 'SanitizedHtml', html: sanitizeHtmlFragment(html) };
}

interface SafeHtmlProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'dangerouslySetInnerHTML'> {
  html: SanitizedHtml;
}

/**
 * The only component allowed to use `dangerouslySetInnerHTML` in the React
 * package. It accepts only `SanitizedHtml` produced by `sanitizeToSafeHtml`.
 */
export function SafeHtml({ html, ...rest }: SafeHtmlProps) {
  return <div {...rest} dangerouslySetInnerHTML={{ __html: html.html }} />;
}
