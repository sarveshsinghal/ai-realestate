"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

type WishlistItem = {
  id: string;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    price: number;
    commune: string;
    kind: string;
    propertyType: string;
    status: string;
    isPublished: boolean;
    thumbnailUrl: string | null;
    popularityBadge: string;
  };
};

type Resp = { items: WishlistItem[]; nextCursor: string | null };

function formatPrice(price: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price} EUR`;
  }
}

function badgeLabel(badge: string) {
  const key = String(badge || "").toUpperCase();
  if (key === "TRENDING") return "Trending";
  if (key === "MOST_SAVED") return "Most saved";
  if (key === "MOST_VIEWED") return "Most viewed";
  return null;
}

export default function WishlistClient() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function load(cursor?: string | null) {
    setLoading(true);
    setError(null);

    const url = cursor
      ? `/api/wishlist?limit=24&cursor=${encodeURIComponent(cursor)}`
      : `/api/wishlist?limit=24`;

    const res = await fetch(url, { cache: "no-store" });

    if (res.status === 401) {
      window.location.href = `/auth/sign-in?callbackUrl=${encodeURIComponent("/wishlist")}`;
      return;
    }

    if (!res.ok) {
      setError("Failed to load saved listings.");
      setLoading(false);
      return;
    }

    const data: Resp = await res.json();
    setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
    setLoading(false);
  }

  useEffect(() => {
    void load(null);
  }, []);

  function remove(listingId: string) {
    startTransition(async () => {
      const prev = items;

      // optimistic
      setItems((x) => x.filter((i) => i.listing.id !== listingId));

      const res = await fetch(`/api/wishlist/${encodeURIComponent(listingId)}`, {
        method: "DELETE",
      });

      if (res.status === 401) {
        setItems(prev);
        toast.error("Please sign in again.");
        window.location.href = `/auth/sign-in?callbackUrl=${encodeURIComponent("/wishlist")}`;
        return;
      }

      if (!res.ok) {
        setItems(prev);
        toast.error("Could not remove saved listing.");
        return;
      }

      try {
        window.dispatchEvent(new Event("wishlist:changed"));
      } catch {}

      toast.success("Removed from saved");
    });
  }

  if (!loading && items.length === 0) {
    return (
      <div className="rounded-3xl border bg-background p-10 text-center">
        <p className="text-base font-medium">No saved listings yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tap the heart icon on any listing to save it here.
        </p>

        <div className="mt-5 flex items-center justify-center">
          <Link
            href="/listings"
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Browse listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const l = it.listing;
          const label = badgeLabel(l.popularityBadge);

          return (
            <div key={it.id} className="overflow-hidden rounded-3xl border bg-background shadow-sm">
              <a href={`/listing/${l.id}`} className="block">
                <div className="relative aspect-[4/3] bg-muted">
                  {l.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.thumbnailUrl} alt={l.title} className="h-full w-full object-cover" />
                  ) : null}

                  {label ? (
                    <div className="absolute left-3 top-3 rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-medium text-white">
                      {label}
                    </div>
                  ) : null}
                </div>

                <div className="p-4">
                  <div className="line-clamp-1 text-sm font-semibold">{l.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {l.commune} • {l.propertyType}
                  </div>
                  <div className="mt-3 text-sm font-medium">{formatPrice(l.price)}</div>
                </div>
              </a>

              <div className="flex items-center justify-between border-t p-3">
                <span className="text-xs text-muted-foreground">
                  Saved {new Date(it.createdAt).toLocaleDateString()}
                </span>

                <button
                  disabled={pending}
                  onClick={() => remove(l.id)}
                  className="rounded-full px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center">
        {nextCursor ? (
          <button
            onClick={() => void load(nextCursor)}
            disabled={loading}
            className="rounded-full border px-5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : (
          <div className="text-sm text-muted-foreground">You’ve reached the end.</div>
        )}
      </div>
    </div>
  );
}