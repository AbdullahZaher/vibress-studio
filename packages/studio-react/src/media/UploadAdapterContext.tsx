import React, { createContext, useContext } from 'react';
import { StudioUploadAdapter } from '@vibress/studio-core';

/**
 * Provides the active upload adapter to card editors. Hosts pass an adapter
 * through `VibressStudioProps.uploadAdapter`; without one, media cards fall
 * back to temporary local previews.
 */
export const StudioUploadAdapterContext = createContext<StudioUploadAdapter | null>(null);

export function StudioUploadAdapterProvider({
  adapter,
  children,
}: {
  adapter: StudioUploadAdapter | null;
  children: React.ReactNode;
}) {
  return (
    <StudioUploadAdapterContext.Provider value={adapter}>
      {children}
    </StudioUploadAdapterContext.Provider>
  );
}

export function useStudioUploadAdapter(): StudioUploadAdapter | null {
  return useContext(StudioUploadAdapterContext);
}
