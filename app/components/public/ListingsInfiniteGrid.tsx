// app/components/public/ListingsInfiniteGrid.tsx
"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import ListingCard from "@/app/components/ListingCard";
import ListingCardSkeleton from "@/app/components/public/ListingCardSkeleton";
import { Button } from "@/components/ui/button";

type SortKey = "recommended" | "newest" | "price_low" | "price_high" | "best";

export default function ListingsInfiniteGrid({
  initialItems,
  initialCursor,
  hasMoreInitial,
  queryString,
  sort,
}: {
  initialItems: any[];
  initialCursor: any | null;
  hasMoreInitial: boolean;
  queryString: string; // from server, without cursor
  sort: SortKey;
}) {
  const [items, setItems] = useState<any[]>(initialItems ?? []);
  const [cursor, setCursor] = useState<any | null>(initialCursor ?? null);
  const [hasMore, setHasMore] = useState<boolean>(hasMoreInitial ?? false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apiBase = useMemo(() => {
    return `/api/public/listings?${queryString}`;
  }, [queryString]);

  async function loadMore() {
    if (!hasMore || loading) return;
    setLoading(true);
    setErr(null);

    try {
      const url = new URL(apiBase, window.location.origin);
      if (cursor) url.searchParams.set("cursor", JSON.stringify(cursor));

      const res = await fetch(url.toString(), { method: "GET" });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const newItems = Array.isArray(data.items) ? data.items : [];

      setItems((prev) => [...prev, ...newItems]);
      setCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load more.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((listing: any) => (
          <ListingCard key={listing.id} listing={listing} href={`/listing/${listing.id}`} />
        ))}

        {/* Skeletons while loading more */}
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <ListingCardSkeleton key={`sk-${i}`} />)
          : null}
      </div>

      <div className="flex flex-col items-center gap-2">
        {err ? <div className="text-sm text-destructive">{err}</div> : null}

        {hasMore ? (
          <Button
            onClick={loadMore}
            disabled={loading}
            className="h-11 rounded-full px-8 bg-emerald-600 hover:bg-emerald-700 text-white"
            type="button"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        ) : (
          <div className="text-sm text-muted-foreground">
            You’ve reached the end{sort ? ` • sorted by ${sort.replace("_", " ")}` : ""}.
          </div>
        )}
      </div>
    </div>
  );
}