// app/agency/listings/new/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function NewListingPage() {
  const router = useRouter();
  const [title, setTitle] = useState<string>("New listing");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function createListing() {
    setError(null);
    const res = await fetch("/api/agency/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error ?? "Failed to create listing");
      return;
    }

    const j = (await res.json()) as { id: string };
    startTransition(() => {
      router.push(`/agency/listings/${j.id}/edit`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Create new listing</h1>

      <div className="mt-6 space-y-3">
        <label className="block text-sm font-medium">Title</label>
        <input
          className="w-full rounded-md border px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
          onClick={() => void createListing()}
          disabled={isPending}
        >
          {isPending ? "Creating..." : "Create & edit"}
        </button>
      </div>
    </div>
  );
}
