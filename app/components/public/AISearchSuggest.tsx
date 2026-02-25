// app/components/public/AISearchSuggest.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, ArrowRight, MapPin, BedDouble, Ruler } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ResultRow = {
  listingId: string;
  score: number;
  commune: string | null;
  price: number | null;
  bedrooms: number | null;
  propertyType: string | null;
};

function formatPriceEUR(n: number | null) {
  if (!n || n <= 0) return "Price on request";
  try {
    return new Intl.NumberFormat("de-LU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `€${Math.round(n).toLocaleString()}`;
  }
}

export default function AISearchSuggest({
  query,
  open,
  onClose,
  className,
}: {
  query: string;
  open: boolean;
  onClose: () => void;
  className?: string;
}) {
  const q = query.trim();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ResultRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<number>(-1);
  const abortRef = useRef<AbortController | null>(null);

  const canSearch = open && q.length >= 2;

  // Debounce input
  useEffect(() => {
    if (!canSearch) {
      setItems([]);
      setErr(null);
      setLoading(false);
      setActive(-1);
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      setActive(-1);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/public/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            query: q,
            paging: { limit: 5, offset: 0 },
            filters: {}, // keep empty for now; can enrich later
          }),
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const rows = Array.isArray(data?.results) ? (data.results as ResultRow[]) : [];
        setItems(rows);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErr(e?.message ?? "Search failed.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q, canSearch]);

  // keyboard navigation
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((prev) => Math.min(prev + 1, items.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter" && active >= 0 && active < items.length) {
        e.preventDefault();
        const id = items[active].listingId;
        window.location.href = `/listing/${id}`;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, items, active, onClose]);

  const viewAllHref = useMemo(() => `/listings?q=${encodeURIComponent(q)}`, [q]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border bg-background shadow-lg",
        className
      )}
      role="dialog"
      aria-label="AI search suggestions"
      ref={listRef}
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          Suggestions
        </div>
        <Link href={viewAllHref} className="text-xs text-emerald-700 hover:underline">
          View all <ArrowRight className="ml-1 inline h-3 w-3" />
        </Link>
      </div>

      <div className="max-h-[340px] overflow-auto p-2">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        ) : err ? (
          <div className="px-3 py-3 text-sm text-destructive">{err}</div>
        ) : !items.length ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">No matches. Try “rent in Kirchberg” or “2 bed under 2500€”.</div>
        ) : (
          <div className="grid gap-1">
            {items.map((r, idx) => {
              const activeRow = idx === active;
              return (
                <Link
                  key={r.listingId}
                  href={`/listing/${r.listingId}`}
                  onClick={onClose}
                  onMouseEnter={() => setActive(idx)}
                  className={cn(
                    "rounded-xl px-3 py-3 transition-colors",
                    activeRow ? "bg-emerald-50" : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {r.propertyType ?? "Property"}{" "}
                        {r.commune ? <span className="text-muted-foreground">• {r.commune}</span> : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {r.commune ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {r.commune}
                          </span>
                        ) : null}

                        {typeof r.bedrooms === "number" ? (
                          <span className="inline-flex items-center gap-1">
                            <BedDouble className="h-3.5 w-3.5" />
                            {r.bedrooms} bed
                          </span>
                        ) : null}

                        <span className="inline-flex items-center gap-1">
                          <Ruler className="h-3.5 w-3.5" />
                          Score {r.score.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-sm font-semibold">{formatPriceEUR(r.price)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">Tip: Use ↑ ↓ and Enter</div>
          <Button
            variant="outline"
            className="h-9"
            onClick={onClose}
            type="button"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}