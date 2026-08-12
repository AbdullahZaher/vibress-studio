import {
  StudioUploadAdapter,
  StudioUploadContext,
  StudioUploadedAsset,
  StudioUploadHandlers,
  StudioUploadLimits,
} from '@vibress/studio-core';

export interface VibressMediaUploadAdapterOptions {
  /**
   * Upload endpoint. The endpoint must accept a multipart POST with a `file`
   * field and return JSON in the shape of `StudioUploadedAsset` (id, url,
   * mimeType, size). No Vibress-specific URL is hardcoded here.
   */
  endpoint: string;
  /** Optional auth header (e.g. `Bearer ...`). */
  authorization?: string;
  limits?: StudioUploadLimits;
  /** Optional fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch-backed upload adapter for the Vibress media API (or any compatible
 * multipart upload endpoint). The endpoint is injected by the host; core
 * packages never hardcode a Vibress API URL.
 */
export class VibressMediaUploadAdapter implements StudioUploadAdapter {
  readonly name = 'vibress-media';
  readonly limits?: StudioUploadLimits;
  private readonly endpoint: string;
  private readonly authorization?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VibressMediaUploadAdapterOptions) {
    this.endpoint = options.endpoint;
    this.authorization = options.authorization;
    this.limits = options.limits;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch.bind(globalThis) as typeof fetch);
  }

  async upload(
    file: File,
    context: StudioUploadContext,
    handlers?: StudioUploadHandlers
  ): Promise<StudioUploadedAsset> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('cardType', context.cardType);
    formData.append('fileName', context.fileName);
    formData.append('mimeType', context.mimeType);

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: this.authorization ? { Authorization: this.authorization } : undefined,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const payload = (await response.json()) as Partial<StudioUploadedAsset>;
    if (!payload.id || !payload.url) {
      throw new Error('Upload response missing id or url');
    }

    handlers?.onProgress?.({ loaded: file.size, total: file.size, percent: 100 });

    return {
      id: payload.id,
      url: payload.url,
      mimeType: payload.mimeType ?? context.mimeType,
      size: payload.size ?? file.size,
      width: payload.width,
      height: payload.height,
      duration: payload.duration,
      alt: payload.alt ?? context.fileName,
      caption: payload.caption,
    };
  }
}
