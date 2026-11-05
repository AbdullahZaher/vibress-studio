/** Picker/upload append policy: a matching non-empty durable ID OR an exact
 * trimmed URL identifies an already inserted image. URLs retain query strings;
 * filenames are never identities. Only additions are filtered: existing order,
 * repetitions, references and metadata remain untouched. There is no picker
 * command for intentional repeats; persisted authored repeats remain supported.
 */
export function appendGalleryImages<T extends { src: string; alt: string; assetId?: string | undefined }>(
  existing: unknown[], additions: T[]
): unknown[] {
  const assetIds = new Set<string>();
  const urls = new Set<string>();
  const identity = (item: unknown) => {
    const entry = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown> : {};
    return {
      assetId: typeof entry.assetId === 'string' ? entry.assetId.trim() : '',
      src: typeof entry.src === 'string' ? entry.src.trim() : '',
    };
  };
  const remember = ({ assetId, src }: ReturnType<typeof identity>) => {
    if (assetId) assetIds.add(assetId);
    if (src) urls.add(src);
  };
  existing.forEach(item => remember(identity(item)));
  const merged = [...existing];
  for (const image of additions) {
    const id = identity(image);
    if (!id.src || (id.assetId && assetIds.has(id.assetId)) || urls.has(id.src)) continue;
    merged.push(image);
    remember(id);
  }
  return merged;
}
