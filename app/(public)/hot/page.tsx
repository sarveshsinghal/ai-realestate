// app/(public)/hot/page.tsx
import { headers } from "next/headers";
import Link from "next/link";

import ListingsFiltersBar from "@/app/components/public/ListingsFiltersBar";
import ListingsInfiniteGrid from "@/app/components/public/ListingsInfiniteGrid";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

type SortKey = "recommended" | "newest" | "price_low" | "price_high" | "best";

function getOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  const h = headers();
  const host =
    (h as any).get?.("x-forwarded-host") ?? (h as any).get?.("host") ?? "localhost:3000";
  const proto = (h as any).get?.("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

type CommuneRow = { commune: string; total: number };

export default async function HotPage({
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

  // Pass-through supported filters (same as /listings)
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

  // Force recommended by default for "Hot"
  const sort = (params.get("sort") ?? "recommended") as SortKey;
  if (!params.get("sort")) params.set("sort", "recommended");

  // If commune not provided, auto-pick the hottest commune
  if (!params.get("commune")) {
    const rows = await prisma.$queryRaw<CommuneRow[]>`
      select
        l.commune as commune,
        sum(lp."score7d")::float8 as total
      from "Listing" l
      join "ListingPopularity" lp on lp."listingId" = l.id
      where l."isPublished" = true
        and l."status" = 'ACTIVE'
        and l.commune is not null
        and btrim(l.commune) <> ''
      group by l.commune
      order by total desc
      limit 1;
    `;

    const top = rows?.[0]?.commune?.trim();
    if (top) params.set("commune", top);
  }

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
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">🗺️ Hot this week</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                High-interest listings by commune, ranked by recent activity.
              </p>
            </div>

            <Button asChild variant="outline" className="rounded-full">
              <Link href="/listings">Browse all</Link>
            </Button>
          </div>
        </div>

        <ListingsFiltersBar />

        <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="rounded-3xl border bg-background/70 p-6 text-sm text-muted-foreground shadow-sm">
            Could not load hot listings. Please refresh and try again.
          </div>
        </div>
      </div>
    );
  }

  const data = await res.json();
  const initialItems = Array.isArray(data.items) ? data.items : [];
  const communeLabel = params.get("commune");

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              🗺️ Hot this week{communeLabel ? ` in ${communeLabel}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked by recent saves + views (with decay) and your filters.
            </p>
          </div>

          <Button asChild variant="outline" className="rounded-full">
            <Link href="/listings?sort=recommended">Explore all</Link>
          </Button>
        </div>
      </div>

      <ListingsFiltersBar />

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        {initialItems.length === 0 ? (
          <div className="rounded-3xl border bg-background/70 p-8 text-sm text-muted-foreground shadow-sm">
            <div className="text-base font-medium text-foreground">No hot listings found</div>
            <div className="mt-1">
              Try widening filters (remove bedrooms/min price) or switch commune.
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="rounded-full">
                <Link href="/listings?sort=recommended">Browse all listings</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ListingsInfiniteGrid
            initialItems={initialItems}
            initialCursor={data.nextCursor ?? null}
            hasMoreInitial={Boolean(data.hasMore)}
            queryString={queryString}
            sort={sort}
          />
        )}
      </div>
    </div>
  );
}