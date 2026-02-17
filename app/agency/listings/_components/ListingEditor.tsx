// app/agency/listings/_components/ListingEditor.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MediaGalleryManager from "./MediaGalleryManager";

type ListingEditorProps = {
  listing: {
    id: string;
    title: string;
    price: number | null;
    isPublished: boolean;
  };
  initialMedia: { url: string; sortOrder: number }[];
  priceHistory: { price: number; createdAt: string }[];
};

export default function ListingEditor(props: ListingEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState<string>(props.listing.title);
  const [priceText, setPriceText] = useState<string>(
    props.listing.price === null ? "" : String(props.listing.price)
  );

  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const parsedPrice = useMemo(() => {
    if (priceText.trim().length === 0) return null;
    const n = Number(priceText);
    return Number.isFinite(n) ? n : null;
  }, [priceText]);

  async function saveBasics() {
    setError(null);
    setSavedAt(null);

    const payload: { title: string; price?: number } = { title };
    if (parsedPrice !== null) payload.price = parsedPrice;

    const res = await fetch(`/api/agency/listings/${props.listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error ?? "Failed to save");
      return;
    }

    setSavedAt(new Date().toLocaleString());
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Details</h2>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Price</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              inputMode="decimal"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              disabled={isPending}
              placeholder="e.g. 750000"
            />
            <p className="mt-1 text-xs text-gray-500">
              Changing price automatically appends to price history.
            </p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {savedAt ? <p className="text-sm text-green-700">Saved: {savedAt}</p> : null}

          <div>
            <button
              className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
              onClick={() => void saveBasics()}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </section>

      <MediaGalleryManager listingId={props.listing.id} initialMedia={props.initialMedia} />

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Price history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Date</th>
                <th className="py-2 text-left font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {props.priceHistory.length === 0 ? (
                <tr>
                  <td className="py-3 text-gray-600" colSpan={2}>
                    No price changes yet.
                  </td>
                </tr>
              ) : (
                props.priceHistory.map((p) => (
                  <tr key={`${p.createdAt}-${p.price}`} className="border-b">
                    <td className="py-2">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="py-2">{p.price.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
