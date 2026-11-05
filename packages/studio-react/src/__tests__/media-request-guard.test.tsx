import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMediaRequestGuard } from '../utils/useMediaRequestGuard';

describe('media request busy ownership', () => {
  it('keeps concurrent additive leases independent and finish idempotent', () => {
    const v = renderHook(useMediaRequestGuard);
    let a!: ReturnType<typeof v.result.current.beginRequest>;
    let b!: typeof a;
    act(() => { a = v.result.current.beginRequest(false, true); b = v.result.current.beginRequest(false, true); });
    expect(v.result.current.uploading).toBe(true);
    act(() => { a.finish(); a.finish(); });
    expect(v.result.current.uploading).toBe(true); expect(b()).toBe(true);
    act(() => b.finish()); expect(v.result.current.uploading).toBe(false);
    v.unmount(); expect(a()).toBe(false); expect(b()).toBe(false);
    act(() => b.finish());
  });
  it('revokes old leases when a picker supersedes, without clearing newer uploads on obsolete completion', () => {
    const v = renderHook(useMediaRequestGuard);
    let a!: ReturnType<typeof v.result.current.beginRequest>; let b!: typeof a;
    act(() => { a = v.result.current.beginRequest(true, true); });
    act(() => { v.result.current.beginRequest(); });
    expect(a()).toBe(false); expect(v.result.current.uploading).toBe(false);
    act(() => { b = v.result.current.beginRequest(true, true); a.finish(); });
    expect(v.result.current.uploading).toBe(true);
    act(() => b.finish()); expect(v.result.current.uploading).toBe(false);
  });
});
