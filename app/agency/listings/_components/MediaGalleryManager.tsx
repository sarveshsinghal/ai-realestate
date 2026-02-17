"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import {
  LISTING_MEDIA_BUCKET,
  extractStorageKeyFromPublicUrl,
} from "@/lib/storage";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type MediaItem = {
  id: string; // UI-only stable id for dnd-kit
  url: string;
  path?: string;
};

type Props = {
  listingId: string;
  initialMedia: { url: string; sortOrder: number }[];
};

function sanitizeFilename(name: string): string {
  const base = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "");
  return base.length > 0 ? base.slice(0, 80) : "file";
}

function humanizeSupabaseStorageError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("row-level security")) {
    return "Upload blocked by Storage security policy (RLS). This usually means the file path does not match the allowed pattern or your account does not have permission for this listing.";
  }
  if (m.includes("jwt")) {
    return "Upload failed due to an auth token issue. Try refreshing the page and uploading again.";
  }
  return message;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    return `${u.host}/…/${last}`;
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}

type SortableCardProps = {
  item: MediaItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  isCover: boolean;
  expanded: boolean;
  copied: boolean;
  onToggleExpanded: () => void;
  onCopy: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSetCover: () => void;
};

function SortableCard(props: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: props.item.id,
    disabled: props.disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    boxShadow: isOver ? "0 0 0 2px rgba(0,0,0,0.25) inset" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-white p-3">
      <div className="relative aspect-video overflow-hidden rounded-md bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.item.url}
          alt={`Listing image ${props.index + 1}`}
          className="h-full w-full object-cover"
        />

        {props.isCover ? (
          <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
            Cover
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-600">#{props.index + 1}</div>

        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs disabled:opacity-50 cursor-grab active:cursor-grabbing"
            disabled={props.disabled}
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            ≡
          </button>

          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
            onClick={props.onMoveUp}
            disabled={props.disabled || props.isFirst}
            title="Move up"
          >
            ↑
          </button>

          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
            onClick={props.onMoveDown}
            disabled={props.disabled || props.isLast}
            title="Move down"
          >
            ↓
          </button>

          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
            onClick={props.onSetCover}
            disabled={props.disabled || props.isCover}
            title="Set as cover"
          >
            Cover
          </button>

          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs text-red-600 disabled:opacity-50"
            onClick={props.onRemove}
            disabled={props.disabled}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 break-all text-[10px] text-gray-500">
          {props.expanded ? props.item.url : shortUrl(props.item.url)}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-[10px] disabled:opacity-50"
            onClick={props.onToggleExpanded}
            disabled={props.disabled}
          >
            {props.expanded ? "Hide" : "Show"}
          </button>

          <button
            type="button"
            className="rounded-md border px-2 py-1 text-[10px] disabled:opacity-50"
            onClick={props.onCopy}
            disabled={props.disabled}
          >
            {props.copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverlayCard({ url }: { url: string }) {
  return (
    <div className="w-[280px] rounded-md border bg-white p-3 shadow-lg">
      <div className="aspect-video overflow-hidden rounded-md bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="mt-2 text-xs text-gray-600">Dragging…</div>
    </div>
  );
}

export default function MediaGalleryManager({ listingId, initialMedia }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<MediaItem[]>(
    initialMedia
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        id: crypto.randomUUID(), // stable within this session, avoids URL-based ids
        url: m.url,
        path:
          extractStorageKeyFromPublicUrl(m.url, LISTING_MEDIA_BUCKET) ??
          undefined,
      }))
  );

  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [expandedUrlIdx, setExpandedUrlIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const debounceRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const persist = useCallback(
    async (nextItems: MediaItem[]): Promise<boolean> => {
      setError(null);
      setIsSaving(true);

      const res = await fetch(`/api/agency/listings/${listingId}/media`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media: nextItems.map((m) => ({ url: m.url })) }),
      });

      setIsSaving(false);

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? "Failed to save media");
        return false;
      }

      setSavedAt(new Date().toLocaleString());
      router.refresh();
      return true;
    },
    [listingId, router]
  );

  const schedulePersist = useCallback(
    (nextItems: MediaItem[]) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        void persist(nextItems);
      }, 600);
    },
    [persist]
  );

  async function onUploadFiles(files: FileList | null) {
    setError(null);
    setSavedAt(null);

    if (!files || files.length === 0) return;

    setIsSaving(true);

    const uploaded: MediaItem[] = [];

    for (const file of Array.from(files)) {
      const safeName = sanitizeFilename(file.name);
      const objectPath = `listings/${listingId}/${crypto.randomUUID()}-${safeName}`;

      const up = await supabase.storage.from(LISTING_MEDIA_BUCKET).upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

      if (up.error) {
        setIsSaving(false);
        setError(humanizeSupabaseStorageError(up.error.message));
        continue;
      }

      const pub = supabase.storage.from(LISTING_MEDIA_BUCKET).getPublicUrl(objectPath);

      uploaded.push({
        id: crypto.randomUUID(),
        url: pub.data.publicUrl,
        path: objectPath,
      });
    }

    setIsSaving(false);

    if (uploaded.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const next = items.concat(uploaded);
    setItems(next);

    await persist(next);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeAt(idx: number) {
    setError(null);
    setSavedAt(null);

    const target = items[idx];
    if (!target) return;

    const next = items.filter((_, i) => i !== idx);
    setItems(next);

    const ok = await persist(next);
    if (!ok) return;

    const res = await fetch(`/api/agency/listings/${listingId}/media/object`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: target.url,
        path:
          target.path ??
          extractStorageKeyFromPublicUrl(target.url, LISTING_MEDIA_BUCKET) ??
          undefined,
      }),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error ?? "Removed from DB, but failed to delete storage object.");
    }
  }

  function setAsCover(idx: number) {
    if (isSaving) return;
    if (idx <= 0 || idx >= items.length) return;
    const next = arrayMove(items, idx, 0);
    setItems(next);
    schedulePersist(next);
  }

  function moveUp(idx: number) {
    if (isSaving || idx === 0) return;
    const next = arrayMove(items, idx, idx - 1);
    setItems(next);
    schedulePersist(next);
  }

  function moveDown(idx: number) {
    if (isSaving || idx >= items.length - 1) return;
    const next = arrayMove(items, idx, idx + 1);
    setItems(next);
    schedulePersist(next);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === String(active.id));
    const newIndex = items.findIndex((i) => i.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    schedulePersist(next);
  }

  async function copyUrl(idx: number, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIdx(idx);
      window.setTimeout(() => {
        setCopiedIdx((cur) => (cur === idx ? null : cur));
      }, 1200);
    } catch {
      setError("Could not copy to clipboard (browser permission).");
    }
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  return (
    <section className="rounded-lg border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Photos</h2>

        <div className="flex items-center gap-3">
          {isSaving ? (
            <span className="text-sm text-gray-500">Saving...</span>
          ) : savedAt ? (
            <span className="text-sm text-green-700">Saved {savedAt}</span>
          ) : null}

          <label className="cursor-pointer rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-60">
            Upload
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void onUploadFiles(e.target.files)}
              disabled={isSaving}
            />
          </label>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        Drag using the ≡ handle to reorder. Use <span className="font-medium">Cover</span> to set the first image.
        Changes save automatically.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {items.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-gray-600">
          No images yet. Upload some photos to build the gallery.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m, idx) => (
                <SortableCard
                  key={m.id}
                  item={m}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === items.length - 1}
                  disabled={isSaving}
                  isCover={idx === 0}
                  expanded={expandedUrlIdx === idx}
                  copied={copiedIdx === idx}
                  onToggleExpanded={() =>
                    setExpandedUrlIdx((cur) => (cur === idx ? null : idx))
                  }
                  onCopy={() => void copyUrl(idx, m.url)}
                  onRemove={() => void removeAt(idx)}
                  onMoveUp={() => moveUp(idx)}
                  onMoveDown={() => moveDown(idx)}
                  onSetCover={() => setAsCover(idx)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? <OverlayCard url={activeItem.url} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  );
}
