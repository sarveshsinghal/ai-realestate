// app/(public)/trending/page.tsx
import { headers } from "next/headers";
import Link from "next/link";

import ListingsInfiniteGrid from "@/app/components/public/ListingsInfiniteGrid";
import { Button } from "@/components/ui/button";

type SortKey = "recommended" | "newest" | "price_low" | "price_high";

function getOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  const h = headers();
  const host =
    (h as any).get?.("x-forwarded-host") ?? (h as any).get?.("host") ?? "localhost:3000";
  const proto = (h as any).get?.("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function TrendingPage() {
  const params = new URLSearchParams();

  // ✅ trending filter + recommended order
  params.set("badge", "TRENDING");
  params.set("sort", "recommended");

  // match your listings take
  const take = 18;
  params.set("take", String(take));

  const queryString = params.toString();

  const origin = getOrigin();
  const url = `${origin}/api/public/listings?${queryString}`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    return (
      <div className="space-y-6">
        <div className="mx-auto w-full max-w-7xl px-4 pt-2 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">🔥 Trending Now</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                The most popular listings right now across Luxembourg.
              </p>
            </div>

            <Button asChild variant="outline" className="rounded-full">
              <Link href="/listings">Browse all</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="rounded-3xl border bg-background/70 p-6 text-sm text-muted-foreground shadow-sm">
            Could not load trending listings. Please refresh and try again.
          </div>
        </div>
      </div>
    );
  }

  const data = await res.json();
  const initialItems = Array.isArray(data.items) ? data.items : [];

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-7xl px-4 pt-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">🔥 Trending Now</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The most popular listings right now across Luxembourg.
            </p>
          </div>

          <Button asChild variant="outline" className="rounded-full">
            <Link href="/listings">Browse all</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        {initialItems.length === 0 ? (
          <div className="rounded-3xl border bg-background/70 p-8 text-sm text-muted-foreground shadow-sm">
            <div className="text-base font-medium text-foreground">No trending listings yet</div>
            <div className="mt-1">
              Once your popularity cron starts assigning the TRENDING badge, they’ll show up here.
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="rounded-full">
                <Link href="/listings">Browse all listings</Link>
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
            sort={"recommended" as SortKey}
          />
        )}
      </div>
    </div>
  );
}