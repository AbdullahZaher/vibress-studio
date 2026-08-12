import React from 'react';
import { MediaUploadState } from '../../media/useMediaUpload';

interface UploadStatusOverlayProps {
  state: Pick<MediaUploadState, 'status' | 'progress' | 'error'>;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Progress bar + error/retry overlay used by media card editors. */
export function UploadStatusOverlay({ state, onRetry, onDismiss }: UploadStatusOverlayProps) {
  if (state.status === 'uploading') {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 rounded">
        <div className="text-xs text-gray-600 mb-1">Uploading… {state.progress}%</div>
        <div className="w-40 h-1.5 bg-gray-200 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="absolute inset-x-0 top-0 z-10 flex flex-col gap-1.5 items-center justify-center bg-red-50 border border-red-200 rounded p-3"
      >
        <p className="text-xs text-red-700">Upload failed: {state.error}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-2 py-1 text-xs bg-white border border-red-300 text-red-700 rounded hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}
