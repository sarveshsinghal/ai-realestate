// app/(public)/listings/page.tsx
import { headers } from "next/headers";

import ListingsFiltersBar from "@/app/components/public/ListingsFiltersBar";
import ListingsInfiniteGrid from "@/app/components/public/ListingsInfiniteGrid";

type SortKey = "recommended" | "newest" | "price_low" | "price_high" | "best";

function getOrigin() {
  // Preferred: explicit env
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  // Fallback: infer from request headers (works behind proxies too)
  const h = headers();

  // Next 16: headers() returns a Headers-like object; use `.get` safely
  const host =
    (h as any).get?.("x-forwarded-host") ??
    (h as any).get?.("host") ??
    "localhost:3000";

  const proto = (h as any).get?.("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function PublicListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const params = new URLSearchParams();

  const put = (k: string) => {
    const v = sp[k];
    if (typeof v === "string" && v.trim()) params.set(k, v.trim());
  };

  // supported params
  put("q");
  put("commune");
  put("kind");
  put("propertyType");
  put("bedrooms");
  put("minPrice");
  put("maxPrice");
  put("minSize");
  put("maxSize");
  put("sort");

  const sort = (params.get("sort") ?? "recommended") as SortKey;

  const take = 18;
  params.set("take", String(take));

  const queryString = params.toString();

  const origin = getOrigin();
  const url = `${origin}/api/public/listings?${queryString}`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    return (
      <div className="space-y-6">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse properties across Luxembourg.
          </p>
        </div>

        <ListingsFiltersBar />

        <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="rounded-3xl border bg-background/70 p-6 text-sm text-muted-foreground shadow-sm">
            Could not load listings. Please refresh and try again.
          </div>
        </div>
      </div>
    );
  }

  const data = await res.json();

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search naturally (FR/LU/DE/EN) — hybrid AI ranking when you use a query.
        </p>
      </div>

      <ListingsFiltersBar />

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <ListingsInfiniteGrid
          initialItems={Array.isArray(data.items) ? data.items : []}
          initialCursor={data.nextCursor ?? null}
          hasMoreInitial={Boolean(data.hasMore)}
          queryString={queryString}
          sort={sort}
        />
      </div>
    </div>
  );
}