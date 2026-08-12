import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StudioUploadAdapter,
  StudioUploadCardType,
  StudioUploadContext,
  StudioUploadedAsset,
  validateFileForUpload,
} from '@vibress/studio-core';
import { createObjectUrl, revokeObjectUrl } from './object-url';

export type MediaUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface MediaUploadState {
  status: MediaUploadStatus;
  progress: number;
  error: string | null;
  asset: StudioUploadedAsset | null;
  /** Temporary local preview URL (must be revoked on cleanup/success). */
  previewUrl: string | null;
}

export interface UseMediaUploadOptions {
  adapter: StudioUploadAdapter | null;
  cardType: StudioUploadCardType;
  onSuccess?: (asset: StudioUploadedAsset) => void;
}

const IDLE_STATE: MediaUploadState = {
  status: 'idle',
  progress: 0,
  error: null,
  asset: null,
  previewUrl: null,
};

/**
 * Drives a media card upload: local object-URL preview, adapter upload,
 * progress, error state, and retry. Temporary preview URLs are always
 * revoked (`URL.revokeObjectURL`) on success, cleanup, and unmount.
 */
export function useMediaUpload({ adapter, cardType, onSuccess }: UseMediaUploadOptions) {
  const [state, setState] = useState<MediaUploadState>(IDLE_STATE);
  const lastFileRef = useRef<File | null>(null);

  // Revoke any lingering preview URL when the hook unmounts.
  useEffect(() => {
    return () => {
      if (stateRef.current.previewUrl) {
        revokeObjectUrl(stateRef.current.previewUrl);
      }
    };
  }, []);

  // Keep a ref of the current state for the unmount cleanup above.
  const stateRef = useRef(state);
  stateRef.current = state;

  const upload = useCallback(
    async (file: File): Promise<StudioUploadedAsset | null> => {
      lastFileRef.current = file;

      if (!adapter) {
        // No adapter: temporary local preview only (not persisted).
        const previewUrl = createObjectUrl(file);
        setState({
          status: 'success',
          progress: 100,
          error: null,
          asset: {
            id: `local-${Date.now()}`,
            url: previewUrl ?? file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            alt: file.name,
          },
          previewUrl,
        });
        return null;
      }

      try {
        validateFileForUpload(file, adapter.limits);
      } catch (err) {
        setState({
          status: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : String(err),
          asset: null,
          previewUrl: null,
        });
        return null;
      }

      const previewUrl = createObjectUrl(file);
      setState({ status: 'uploading', progress: 0, error: null, asset: null, previewUrl });

      const context: StudioUploadContext = {
        cardType,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      };

      try {
        const asset = await adapter.upload(file, context, {
          onProgress: ({ percent }) => {
            setState((prev) =>
              prev.previewUrl === previewUrl
                ? { ...prev, status: 'uploading', progress: percent }
                : prev
            );
          },
        });

        // Success: persist the real asset URL and revoke the temporary preview.
        revokeObjectUrl(previewUrl);
        setState({ status: 'success', progress: 100, error: null, asset, previewUrl: null });
        onSuccess?.(asset);
        return asset;
      } catch (err) {
        // Error: keep the preview so the user can retry visually.
        setState({
          status: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : String(err),
          asset: null,
          previewUrl,
        });
        return null;
      }
    },
    [adapter, cardType, onSuccess]
  );

  /** Retry the last file (or a new one). */
  const retry = useCallback(
    (file?: File) => {
      const target = file ?? lastFileRef.current;
      if (target) return upload(target);
      return Promise.resolve(null);
    },
    [upload]
  );

  /** Clear the current state and revoke any preview URL. */
  const clear = useCallback(() => {
    setState((prev) => {
      revokeObjectUrl(prev.previewUrl);
      return IDLE_STATE;
    });
  }, []);

  return { ...state, upload, retry, clear };
}
