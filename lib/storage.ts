// lib/storage.ts
export const LISTING_MEDIA_BUCKET = "listing-media";

/**
 * Extracts the object key from a public URL:
 * .../storage/v1/object/public/<bucket>/<key>
 */
export function extractStorageKeyFromPublicUrl(
  publicUrl: string,
  bucket: string = LISTING_MEDIA_BUCKET
): string | null {
  try {
    const u = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const key = u.pathname.slice(idx + marker.length);
    return key.length > 0 ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}
