import { useCallback, useEffect, useRef, useState } from 'react';

/** The replacement request owns application ordering, while each upload owns
 * its own busy lease. Starting a replacement revokes old leases immediately;
 * obsolete completions cannot clear a newer upload's lease. Gallery additions
 * opt out of replacement ordering and keep independent concurrent leases.
 * Network cancellation/durable asset cleanup remain host responsibilities. */
export function useMediaRequestGuard() {
  const state = useRef({ mounted: true, version: 0, nextId: 0, uploads: new Set<number>() });
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    state.current.mounted = true;
    return () => {
      state.current.mounted = false;
      state.current.version++;
      state.current.uploads.clear();
    };
  }, []);
  const beginRequest = useCallback((replacePrevious = true, upload = false) => {
    const current = state.current;
    if (replacePrevious) { current.version++; current.uploads.clear(); }
    const version = current.version;
    const id = ++current.nextId;
    if (upload) current.uploads.add(id);
    if (current.mounted) setUploading(current.uploads.size > 0);
    const isCurrent = () => state.current.mounted && version === state.current.version;
    return Object.assign(isCurrent, {
      finish: () => {
        // Deleting only this lease makes settlement idempotent and prevents an
        // obsolete finally from clearing another request's busy indicator.
        if (state.current.uploads.delete(id) && state.current.mounted) {
          setUploading(state.current.uploads.size > 0);
        }
      },
    });
  }, []);
  return { beginRequest, uploading };
}
