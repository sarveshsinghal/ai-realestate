// app/components/public/listing-normalize.ts

const PLACEHOLDER_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0fdf4"/>
      <stop offset="1" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="80" y="80" width="1040" height="740" rx="48" fill="#ffffff" opacity="0.55"/>
  <text x="50%" y="50%" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto" font-size="42" text-anchor="middle" fill="#64748b">
    EstateIQ • Image coming soon
  </text>
</svg>
`);

export const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=utf-8,${PLACEHOLDER_SVG}`;

export function normalizeListingImages(listing: any): string[] {
  const urls: string[] = [];

  // Prefer media[] (Prisma ListingMedia)
  if (Array.isArray(listing?.media)) {
    for (const m of listing.media) {
      if (m?.url && typeof m.url === "string") urls.push(m.url);
    }
  }

  // Backward compatible with older mock shape: images: string[]
  if (Array.isArray(listing?.images)) {
    for (const u of listing.images) {
      if (typeof u === "string" && u.trim()) urls.push(u);
    }
  }

  // Deduplicate
  const deduped = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));

  return deduped.length ? deduped : [PLACEHOLDER_IMAGE];
}