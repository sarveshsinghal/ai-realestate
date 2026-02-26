"use client";

import { useEffect } from "react";

export default function ListingViewTrackerClient({ listingId }: { listingId: string }) {
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    const key = `view:${listingId}:${day}`;

    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // ignore
    }

    void fetch(`/api/public/listings/${encodeURIComponent(listingId)}/view`, {
      method: "POST",
    }).catch(() => {});
  }, [listingId]);

  return null;
}