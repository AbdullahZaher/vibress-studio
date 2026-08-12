import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  MemoryUploadAdapter,
  validateFileForUpload,
  StudioUploadError,
  StudioUploadLimits,
} from '@vibress/studio-core';
import { useMediaUpload } from '@vibress/studio-react';
import { VibressMediaUploadAdapter } from '@vibress/studio-react';

/**
 * P5: media upload adapter contract, file validation, preview URL cleanup,
 * progress/error/retry states, and the fetch-backed adapter.
 */

function makeFile(name = 'a.png', type = 'image/png', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  // jsdom lacks createObjectURL/revokeObjectURL; simulate them.
  let counter = 0;
  const created: string[] = [];
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => {
      const url = `blob:mock-${counter++}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => {
      const idx = created.indexOf(url);
      if (idx !== -1) created.splice(idx, 1);
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MemoryUploadAdapter (P5)', () => {
  it('uploads a file and returns persisted asset metadata', async () => {
    const adapter = new MemoryUploadAdapter();
    const file = makeFile('photo.png', 'image/png', 2048);
    const asset = await adapter.upload(file, { cardType: 'image', fileName: file.name, mimeType: file.type, size: file.size });
    expect(asset.id).toBeTruthy();
    expect(asset.url).toMatch(/^memory:\/\/asset\//);
    expect(asset.mimeType).toBe('image/png');
    expect(asset.size).toBe(2048);
    expect(asset.alt).toBe('photo.png');
  });

  it('reports progress to handlers', async () => {
    const adapter = new MemoryUploadAdapter();
    const file = makeFile();
    const progressCalls: number[] = [];
    await adapter.upload(file, { cardType: 'image', fileName: 'a', mimeType: 'x', size: file.size }, {
      onProgress: ({ percent }) => progressCalls.push(percent),
    });
    expect(progressCalls).toContain(100);
  });

  it('enforces size limits', async () => {
    const limits: StudioUploadLimits = { maxSizeBytes: 100 };
    const adapter = new MemoryUploadAdapter(limits);
    await expect(
      adapter.upload(makeFile('big.png', 'image/png', 1000), { cardType: 'image', fileName: 'big', mimeType: 'image/png', size: 1000 })
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('enforces MIME type allowlist', async () => {
    const limits: StudioUploadLimits = { allowedMimeTypes: ['image/png'] };
    const adapter = new MemoryUploadAdapter(limits);
    await expect(
      adapter.upload(makeFile('evil.exe', 'application/x-msdownload'), { cardType: 'file', fileName: 'evil', mimeType: 'application/x-msdownload', size: 10 })
    ).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });
  });
});

describe('validateFileForUpload (P5)', () => {
  it('throws StudioUploadError with a code for oversized files', () => {
    try {
      validateFileForUpload(makeFile('x.png', 'image/png', 5000), { maxSizeBytes: 100 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(StudioUploadError);
      expect((err as StudioUploadError).code).toBe('FILE_TOO_LARGE');
    }
  });

  it('accepts files within limits', () => {
    expect(() => validateFileForUpload(makeFile('x.png', 'image/png', 50), { maxSizeBytes: 100, allowedMimeTypes: ['image/png'] })).not.toThrow();
  });
});

describe('useMediaUpload hook (P5)', () => {
  it('uploads via adapter, persists asset, and calls onSuccess', async () => {
    const adapter = new MemoryUploadAdapter();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useMediaUpload({ adapter, cardType: 'image', onSuccess }));

    const file = makeFile();
    let returned: unknown = null;
    await act(async () => {
      returned = await result.current.upload(file);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.asset?.url).toMatch(/^memory:\/\/asset\//);
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(returned).toMatchObject({ mimeType: 'image/png' });
  });

  it('revokes the temporary preview URL after a successful upload', async () => {
    const adapter = new MemoryUploadAdapter();
    const { result } = renderHook(() => useMediaUpload({ adapter, cardType: 'image' }));
    const file = makeFile();
    await act(async () => {
      await result.current.upload(file);
    });
    expect(result.current.previewUrl).toBeNull();
    // revokeObjectURL was called for the created blob URL.
    expect((URL.revokeObjectURL as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('surfaces errors and supports retry', async () => {
    const flakyAdapter: MemoryUploadAdapter & { failNext: boolean } = Object.assign(new MemoryUploadAdapter(), { failNext: false });
    const originalUpload = flakyAdapter.upload.bind(flakyAdapter);
    flakyAdapter.upload = async (file, ctx, handlers) => {
      if (flakyAdapter.failNext) throw new Error('network down');
      return originalUpload(file, ctx, handlers);
    };
    const { result } = renderHook(() => useMediaUpload({ adapter: flakyAdapter, cardType: 'image' }));

    flakyAdapter.failNext = true;
    await act(async () => {
      await result.current.upload(makeFile());
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('network down');

    flakyAdapter.failNext = false;
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.status).toBe('success');
    expect(result.current.asset).not.toBeNull();
  });

  it('falls back to a local preview when no adapter is provided', async () => {
    const { result } = renderHook(() => useMediaUpload({ adapter: null, cardType: 'image' }));
    await act(async () => {
      await result.current.upload(makeFile());
    });
    expect(result.current.status).toBe('success');
    expect(result.current.asset?.url).toContain('blob:mock');
  });

  it('rejects oversized files before upload with an error state', async () => {
    const adapter = new MemoryUploadAdapter({ maxSizeBytes: 10 });
    const { result } = renderHook(() => useMediaUpload({ adapter, cardType: 'image' }));
    await act(async () => {
      await result.current.upload(makeFile('big.png', 'image/png', 5000));
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('FILE_TOO_LARGE');
  });
});

describe('VibressMediaUploadAdapter (P5)', () => {
  it('posts multipart and maps the response to an asset', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ id: 'a1', url: 'https://cdn.example/a.png', mimeType: 'image/png', size: 1234 }),
        { status: 200 }
      )
    );
    const adapter = new VibressMediaUploadAdapter({
      endpoint: 'https://api.example/uploads',
      authorization: 'Bearer tok',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const file = makeFile();
    const asset = await adapter.upload(file, { cardType: 'image', fileName: 'a.png', mimeType: 'image/png', size: file.size });
    expect(asset.id).toBe('a1');
    expect(asset.url).toBe('https://cdn.example/a.png');
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('https://api.example/uploads');
    expect((call[1] as RequestInit).headers).toEqual({ Authorization: 'Bearer tok' });
    expect((call[1] as RequestInit).method).toBe('POST');
  });

  it('throws on non-ok responses', async () => {
    const fetchMock = vi.fn(async () => new Response('denied', { status: 403 }));
    const adapter = new VibressMediaUploadAdapter({
      endpoint: 'https://api.example/uploads',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(adapter.upload(makeFile(), { cardType: 'file', fileName: 'a', mimeType: 'x', size: 1 })).rejects.toThrow(/403/);
  });

  it('throws when the response is missing id or url', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ mimeType: 'x' }), { status: 200 }));
    const adapter = new VibressMediaUploadAdapter({
      endpoint: 'https://api.example/uploads',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(adapter.upload(makeFile(), { cardType: 'file', fileName: 'a', mimeType: 'x', size: 1 })).rejects.toThrow(/missing id or url/);
  });
});
