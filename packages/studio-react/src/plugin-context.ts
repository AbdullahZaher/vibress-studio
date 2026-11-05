import { createContext, useContext } from 'react';
import type { StudioPluginRegistry } from '@vibress/studio-plugin-sdk';

export const StudioPluginContext = createContext<StudioPluginRegistry | null>(null);

export function useStudioPluginRegistry(): StudioPluginRegistry | null {
  return useContext(StudioPluginContext);
}
