import { useCallback, useEffect, useRef } from 'react';

/** Ignore completions after unmount and superseded replacement requests.
 * Additive gallery requests can opt out of replacement ordering. The host
 * still owns network cancellation and durable upload cleanup. */
export function useMediaRequestGuard() {
  const state = useRef({ mounted: true, version: 0 });
  useEffect(() => {
    state.current.mounted = true;
    return () => { state.current.mounted = false; state.current.version++; };
  }, []);
  return useCallback((replacePrevious = true) => {
    const version = replacePrevious ? ++state.current.version : state.current.version;
    return () => state.current.mounted && (!replacePrevious || version === state.current.version);
  }, []);
}
