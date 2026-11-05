import { isSafeStudioUrl } from '@vibress/studio-utils';

export type MediaAssetKind = 'image' | 'video' | 'audio' | 'file';

/** A media source stored in a document must outlive the editor's browser tab. */
export function isDurableMediaUrl(value: unknown): value is string {
  return isSafeStudioUrl(value, 'media');
}

/**
 * Apply only the fields owned by an upload/picker response. Host callbacks
 * may include stale metadata; never overwrite author edits made while the
 * asynchronous request was in flight. Return null for transient/unsafe URLs.
 */
export function mergeDurableMediaAsset(
  current: Record<string, unknown>,
  payload: Record<string, unknown>,
  kind: MediaAssetKind,
  selectedFileName?: string,
): Record<string, unknown> | null {
  if (!isDurableMediaUrl(payload.src)) return null;

  const next: Record<string, unknown> = { ...current, src: payload.src.trim() };
  if (typeof payload.assetId === 'string' && payload.assetId.trim()) {
    next.assetId = payload.assetId.trim();
  } else if (current.src !== next.src) {
    delete next.assetId;
  }

  if (kind === 'video' && !current.poster && isDurableMediaUrl(payload.poster)) {
    next.poster = payload.poster.trim();
  }

  if (kind === 'image') {
    if (!current.alt && typeof payload.alt === 'string') next.alt = payload.alt;
    if (current.width === undefined && typeof payload.width === 'number' &&
        Number.isFinite(payload.width) && payload.width > 0) {
      next.width = payload.width;
    }
    if (typeof payload.height === 'number' && Number.isFinite(payload.height) && payload.height > 0) {
      next.height = payload.height;
    }
  }

  if (kind === 'audio' && !current.title) {
    next.title = selectedFileName || (typeof payload.title === 'string' ? payload.title : '');
  }

  if (kind === 'file') {
    if (!current.fileName) {
      next.fileName = selectedFileName ||
        (typeof payload.fileName === 'string' && payload.fileName ? payload.fileName : 'Download File');
    }
    if (!current.fileSize && typeof payload.fileSize === 'string') {
      next.fileSize = payload.fileSize;
    }
  }

  return next;
}
