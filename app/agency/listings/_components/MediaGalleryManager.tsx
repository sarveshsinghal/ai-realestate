// app/agency/listings/_components/MediaGalleryManager.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { LISTING_MEDIA_BUCKET, extractStorageKeyFromPublicUrl } from "@/lib/storage";

type MediaItem = { url: string };

type Props = {
  listingId: string;
  initialMedia: { url: string; sortOrder: number }[];
};

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function MediaGalleryManager({ listingId, initialMedia }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<MediaItem[]>(
    initialMedia
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({ url: m.url }))
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowser(), []);

  async function persist() {
    setError(null);
    setSavedAt(null);

    const res = await fetch(`/api/agency/listings/${listingId}/media`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media: items }),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error ?? "Failed to save media");
      return;
    }

    setSavedAt(new Date().toLocaleString());
    startTransition(() => router.refresh());
  }

  async function onUploadFiles(files: FileList | null) {
    setError(null);
    setSavedAt(null);
    if (!files || files.length === 0) return;

    const uploaded: MediaItem[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const safeExt = typeof ext === "string" && ext.length > 0 ? ext.toLowerCase() : "bin";

      const path = `listings/${listingId}/${crypto.randomUUID()}.${safeExt}`;

      const up = await supabase.storage.from(LISTING_MEDIA_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

      if (up.error) {
        setError(up.error.message);
        continue;
      }

      const pub = supabase.storage.from(LISTING_MEDIA_BUCKET).getPublicUrl(path);
      const publicUrl = pub.data.publicUrl;

      uploaded.push({ url: publicUrl });
    }

    if (uploaded.length > 0) {
      setItems((prev) => prev.concat(uploaded));
    }
  }

  async function removeAt(idx: number) {
    setError(null);
    setSavedAt(null);

    const target = items[idx];
    if (!target) return;

    // Best-effort delete from Storage (will only succeed if current user owns the object)
    const key = extractStorageKeyFromPublicUrl(target.url, LISTING_MEDIA_BUCKET);
    if (key) {
      const del = await supabase.storage.from(LISTING_MEDIA_BUCKET).remove([key]);
      // If delete fails due to owner policy, we still allow DB removal (no hard error)
      if (del.error) {
        // Keep it non-blocking but visible
        setError(`Removed from gallery, but could not delete storage object: ${del.error.message}`);
      }
    }

    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Photos</h2>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            onClick={() => void persist()}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save gallery"}
          </button>

          <label className="cursor-pointer rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-60">
            Upload
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void onUploadFiles(e.target.files)}
              disabled={isPending}
            />
          </label>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        Upload multiple images, reorder them, remove them, then click <span className="font-medium">Save gallery</span>.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {savedAt ? <p className="mt-3 text-sm text-green-700">Saved: {savedAt}</p> : null}

      {items.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-gray-600">
          No images yet. Upload some photos to build the gallery.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m, idx) => (
            <div key={`${m.url}-${idx}`} className="rounded-md border p-3">
              <div className="aspect-video overflow-hidden rounded-md bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={`Listing image ${idx + 1}`} className="h-full w-full object-cover" />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-xs text-gray-600">#{idx + 1}</div>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                    onClick={() => setItems((prev) => moveItem(prev, idx, Math.max(0, idx - 1)))}
                    disabled={idx === 0 || isPending}
                  >
                    ↑
                  </button>
                  <button
                    className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                    onClick={() => setItems((prev) => moveItem(prev, idx, Math.min(prev.length - 1, idx + 1)))}
                    disabled={idx === items.length - 1 || isPending}
                  >
                    ↓
                  </button>
                  <button
                    className="rounded-md border px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                    onClick={() => void removeAt(idx)}
                    disabled={isPending}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-2 break-all text-[10px] text-gray-500">{m.url}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
