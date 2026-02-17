"use client";

import { useState } from "react";

export default function PublishToggleButton({
  listingId,
  isPublished,
}: {
  listingId: string;
  isPublished: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(isPublished);

  async function onToggle() {
    try {
      setLoading(true);
      const res = await fetch(`/api/agency/listings/${listingId}/publish`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublished: !published }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");

      setPublished(Boolean(data.isPublished));
    } catch (e: any) {
      alert(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className="inline-flex items-center px-3 py-2 rounded-md border text-sm disabled:opacity-50"
    >
      {published ? "Unpublish" : "Publish"}
    </button>
  );
}
