/**
 * Object-URL helpers. `URL.createObjectURL` is not implemented in jsdom or
 * SSR environments, so every call is guarded. Temporary URLs must be revoked
 * with `revokeObjectUrl` when no longer needed (see useMediaUpload).
 */

export function createObjectUrl(file: File): string | null {
  try {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(file);
    }
  } catch {
    // fall through
  }
  return null;
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    if (url.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  } catch {
    // fall through
  }
}
