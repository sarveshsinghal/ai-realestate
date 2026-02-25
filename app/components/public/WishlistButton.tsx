// app/components/public/WishlistButton.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const KEY = "estateiq:wishlist";

function readWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeWishlist(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export default function WishlistButton({
  listingId,
  className,
}: {
  listingId: string;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readWishlist());
    setReady(true);
  }, []);

  const saved = useMemo(() => ids.includes(listingId), [ids, listingId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setIds((prev) => {
      const next = prev.includes(listingId)
        ? prev.filter((id) => id !== listingId)
        : [listingId, ...prev];
      writeWishlist(next);
      return next;
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggle}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      className={cn(
        "h-10 w-10 rounded-full p-0 bg-background/85 backdrop-blur border-white/60 shadow-sm hover:bg-background",
        className
      )}
      disabled={!ready}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          saved ? "fill-emerald-600 text-emerald-600" : "text-foreground/70"
        )}
      />
    </Button>
  );
}