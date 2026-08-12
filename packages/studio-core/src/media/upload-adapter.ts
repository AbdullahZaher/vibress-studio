/**
 * Media upload adapter contract.
 *
 * Core defines the contract only — it never hardcodes a specific upload API.
 * Host applications provide an adapter (or use `MemoryUploadAdapter` for
 * local previews and tests). See docs/media-upload-adapter.md.
 */

export type StudioUploadCardType = 'image' | 'gallery' | 'video' | 'audio' | 'file';

export interface StudioUploadContext {
  cardType: StudioUploadCardType;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface StudioUploadedAsset {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  alt?: string;
  caption?: string;
}

export interface StudioUploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface StudioUploadHandlers {
  onProgress?: (progress: StudioUploadProgress) => void;
}

export interface StudioUploadLimits {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export interface StudioUploadAdapter {
  readonly name: string;
  /** Optional client-side file validation before upload begins. */
  readonly limits?: StudioUploadLimits;
  upload(
    file: File,
    context: StudioUploadContext,
    handlers?: StudioUploadHandlers
  ): Promise<StudioUploadedAsset>;
  abort?(uploadId: string): Promise<void>;
}

/** Default size cap when an adapter does not declare one: 25 MB. */
export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class StudioUploadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'StudioUploadError';
    this.code = code;
  }
}

/**
 * Validate a file against adapter limits (size + MIME type allowlist).
 * Throws `StudioUploadError` when the file is rejected.
 */
export function validateFileForUpload(
  file: File,
  limits?: StudioUploadLimits
): void {
  const maxSizeBytes = limits?.maxSizeBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  if (file.size > maxSizeBytes) {
    throw new StudioUploadError(
      'FILE_TOO_LARGE',
      `FILE_TOO_LARGE: file is ${file.size} bytes, limit is ${maxSizeBytes} bytes`
    );
  }
  if (limits?.allowedMimeTypes && !limits.allowedMimeTypes.includes(file.type)) {
    throw new StudioUploadError(
      'FILE_TYPE_NOT_ALLOWED',
      `FILE_TYPE_NOT_ALLOWED: file type "${file.type}" is not allowed`
    );
  }
}

/**
 * In-memory upload adapter for tests and local previews. Produces
 * `memory://` URLs (not persisted). Simulates progress for upload UX tests.
 */
export class MemoryUploadAdapter implements StudioUploadAdapter {
  readonly name = 'memory';
  readonly limits?: StudioUploadLimits;
  private counter = 0;

  constructor(limits?: StudioUploadLimits) {
    this.limits = limits;
  }

  async upload(
    file: File,
    context: StudioUploadContext,
    handlers?: StudioUploadHandlers
  ): Promise<StudioUploadedAsset> {
    validateFileForUpload(file, this.limits);
    this.counter += 1;
    const id = `memory-${Date.now()}-${this.counter}`;

    // Simulate async work + progress so upload UX can be exercised.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    handlers?.onProgress?.({ loaded: file.size, total: file.size, percent: 100 });

    return {
      id,
      url: `memory://asset/${id}`,
      mimeType: file.type || context.mimeType || 'application/octet-stream',
      size: file.size,
      alt: context.fileName,
    };
  }
}
