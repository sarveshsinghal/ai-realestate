"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type UploadState = "queued" | "uploading" | "done" | "error";

type UploadItem = {
  id: string;
  name: string;
  state: UploadState;
  error?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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

function formatNowTime(): string {
  return new Date().toLocaleString();
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

  // UI-only hints
  isDragOverlay?: boolean;
  willBecomeCover?: boolean;

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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        "group rounded-lg border bg-white p-3 shadow-sm transition",
        props.isDragOverlay ? "shadow-lg" : "",
        isOver ? "ring-2 ring-black/10" : ""
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.item.url}
          alt={`Listing image ${props.index + 1}`}
          className="h-full w-full object-cover"
        />

        {props.isCover ? (
          <div className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-1 text-xs font-medium text-white">
            Primary
          </div>
        ) : null}

        {!props.isCover && props.willBecomeCover ? (
          <div className="absolute left-2 top-2 rounded-md bg-green-600/90 px-2 py-1 text-xs font-medium text-white">
            Drop to set Primary
          </div>
        ) : null}

        {/* Quick actions */}
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 shadow-sm backdrop-blur disabled:opacity-50"
            onClick={props.onSetCover}
            disabled={props.disabled || props.isCover}
            title={props.isCover ? "Already primary" : "Set as primary"}
          >
            {props.isCover ? "Primary" : "Set primary"}
          </button>

          <button
            type="button"
            className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm backdrop-blur disabled:opacity-50"
            onClick={props.onRemove}
            disabled={props.disabled}
            title="Remove image"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-600">
          <span className="font-medium text-gray-900">#{props.index + 1}</span>
          {props.isCover ? (
            <span className="ml-2 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
              Primary
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <button
            type="button"
            className={cx(
              "rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 disabled:opacity-50",
              "cursor-grab active:cursor-grabbing"
            )}
            disabled={props.disabled}
            title="Drag to reorder"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            ≡
          </button>

          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 disabled:opacity-50"
            onClick={props.onMoveUp}
            disabled={props.disabled || props.isFirst}
            title="Move up"
            aria-label="Move up"
          >
            ↑
          </button>

          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 disabled:opacity-50"
            onClick={props.onMoveDown}
            disabled={props.disabled || props.isLast}
            title="Move down"
            aria-label="Move down"
          >
            ↓
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0 break-all text-[11px] text-gray-500">
          {props.expanded ? props.item.url : shortUrl(props.item.url)}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-800 disabled:opacity-50"
            onClick={props.onToggleExpanded}
            disabled={props.disabled}
          >
            {props.expanded ? "Hide" : "Show"}
          </button>

          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-800 disabled:opacity-50"
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
    <div className="w-[280px] rounded-lg border bg-white p-3 shadow-lg">
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
        id: crypto.randomUUID(),
        url: m.url,
        path:
          extractStorageKeyFromPublicUrl(m.url, LISTING_MEDIA_BUCKET) ?? undefined,
      }))
  );

  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [expandedUrlIdx, setExpandedUrlIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const [uploads, setUploads] = useState<UploadItem[]>([]);

  // Drag-and-drop upload zone state
  const [isDropActive, setIsDropActive] = useState(false);
  const dropDepthRef = useRef(0);

  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

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

      setSavedAt(formatNowTime());
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

  const uploadSummary = useMemo(() => {
    if (uploads.length === 0) return null;
    const total = uploads.length;
    const done = uploads.filter((u) => u.state === "done").length;
    const uploading = uploads.filter((u) => u.state === "uploading").length;
    const failed = uploads.filter((u) => u.state === "error").length;

    return { total, done, uploading, failed };
  }, [uploads]);

  function filesFromDataTransfer(dt: DataTransfer): File[] {
    // Prefer dt.files for broad compatibility
    const files = Array.from(dt.files || []);
    // Filter to images only (matches accept="image/*")
    return files.filter((f) => f.type.startsWith("image/"));
  }

  async function handleFiles(files: File[]) {
    setError(null);
    setSavedAt(null);

    if (!files || files.length === 0) return;

    const newUploads: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name || "image",
      state: "queued" as const,
    }));

    setUploads((cur) => cur.concat(newUploads));
    setIsSaving(true);

    const uploaded: MediaItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const uploadId = newUploads[i]!.id;

      setUploads((cur) =>
        cur.map((u) => (u.id === uploadId ? { ...u, state: "uploading" } : u))
      );

      const safeName = sanitizeFilename(file.name || `image-${i + 1}.png`);
      const objectPath = `listings/${listingId}/${crypto.randomUUID()}-${safeName}`;

      const up = await supabase.storage.from(LISTING_MEDIA_BUCKET).upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

      if (up.error) {
        const msg = humanizeSupabaseStorageError(up.error.message);
        setUploads((cur) =>
          cur.map((u) =>
            u.id === uploadId ? { ...u, state: "error", error: msg } : u
          )
        );
        continue;
      }

      const pub = supabase.storage.from(LISTING_MEDIA_BUCKET).getPublicUrl(objectPath);

      uploaded.push({
        id: crypto.randomUUID(),
        url: pub.data.publicUrl,
        path: objectPath,
      });

      setUploads((cur) =>
        cur.map((u) => (u.id === uploadId ? { ...u, state: "done" } : u))
      );
    }

    setIsSaving(false);

    if (uploaded.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const next = items.concat(uploaded);
    setItems(next);

    const ok = await persist(next);

    if (ok) {
      window.setTimeout(() => {
        setUploads((cur) => cur.slice(-3));
      }, 2500);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onUploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    await handleFiles(Array.from(list));
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
    setOverId(null);

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

  const willSetCoverHint = useMemo(() => {
    if (!activeId || !overId) return null;
    const overIndex = items.findIndex((i) => i.id === overId);
    if (overIndex !== 0) return null;
    const activeIndex = items.findIndex((i) => i.id === activeId);
    if (activeIndex <= 0) return null;
    return { activeId, overId };
  }, [activeId, overId, items]);

  // Optional delight: paste-to-upload (images only). Does not change existing behavior.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (isSaving) return;
      const dt = e.clipboardData;
      if (!dt) return;

      const pastedFiles: File[] = [];
      for (const item of Array.from(dt.items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f && f.type.startsWith("image/")) pastedFiles.push(f);
        }
      }

      if (pastedFiles.length === 0) return;

      // Avoid unexpected uploads while typing in another input by requiring focus within this component.
      // Since we don’t have a hard focus trap, we’ll allow paste anywhere on page only if user has at least opened this editor.
      // If you want stricter, we can bind paste to a focusable container ref.
      void handleFiles(pastedFiles);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving]);

  function onDropzoneDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropDepthRef.current += 1;
    setIsDropActive(true);
  }

  function onDropzoneDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropDepthRef.current = Math.max(0, dropDepthRef.current - 1);
    if (dropDepthRef.current === 0) setIsDropActive(false);
  }

  function onDropzoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDropActive) setIsDropActive(true);
  }

  async function onDropzoneDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    dropDepthRef.current = 0;
    setIsDropActive(false);

    if (isSaving) return;

    const dropped = filesFromDataTransfer(e.dataTransfer);
    if (dropped.length === 0) {
      setError("No valid images detected. Please drop image files (PNG/JPG/WebP).");
      return;
    }

    await handleFiles(dropped);
  }

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Photos</h2>
          <p className="mt-1 text-sm text-gray-600">
            Drag to reorder. The <span className="font-medium">first</span> image is the{" "}
            <span className="font-medium">Primary</span> image.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            {isSaving ? (
              <div className="text-sm text-gray-500">Saving…</div>
            ) : savedAt ? (
              <div className="text-sm text-green-700">Saved {savedAt}</div>
            ) : (
              <div className="text-sm text-gray-500">{items.length} images</div>
            )}

            {uploadSummary ? (
              <div className="mt-0.5 text-xs text-gray-500">
                Uploads: {uploadSummary.done}/{uploadSummary.total}
                {uploadSummary.uploading > 0 ? ` · uploading ${uploadSummary.uploading}` : ""}
                {uploadSummary.failed > 0 ? ` · failed ${uploadSummary.failed}` : ""}
              </div>
            ) : null}
          </div>

          <label
            className={cx(
              "cursor-pointer rounded-md bg-black px-3 py-2 text-sm font-medium text-white",
              "hover:bg-gray-900",
              isSaving && "opacity-60 cursor-not-allowed"
            )}
          >
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

      {/* Dropzone / Guidance */}
      <div
        className={cx(
          "mt-4 rounded-lg border p-4 transition",
          isDropActive
            ? "border-black bg-black/5"
            : "border-gray-200 bg-gray-50"
        )}
        onDragEnter={onDropzoneDragEnter}
        onDragLeave={onDropzoneDragLeave}
        onDragOver={onDropzoneDragOver}
        onDrop={(e) => void onDropzoneDrop(e)}
        role="region"
        aria-label="Upload photos dropzone"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-700">
            <span className="font-medium text-gray-900">Upload faster:</span>{" "}
            drag & drop images here, or use the Upload button.
            <span className="ml-2 text-xs text-gray-500">
              (PNG/JPG/WebP · multiple supported)
            </span>
          </div>

          <div className="text-xs text-gray-500">
            Tip: drop onto position <span className="font-medium">#1</span> while reordering to set Primary.
          </div>
        </div>

        {uploads.length > 0 ? (
          <div className="mt-3 rounded-md border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">Upload activity</p>
              <button
                type="button"
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setUploads([])}
                disabled={isSaving}
              >
                Clear
              </button>
            </div>

            <div className="mt-2 space-y-1">
              {uploads.slice(-6).map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate text-xs text-gray-700">{u.name}</div>
                  <div className="shrink-0">
                    {u.state === "queued" ? (
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
                        queued
                      </span>
                    ) : u.state === "uploading" ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                        uploading…
                      </span>
                    ) : u.state === "done" ? (
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] text-green-700">
                        done
                      </span>
                    ) : (
                      <span
                        className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-700"
                        title={u.error}
                      >
                        failed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {uploads.some((u) => u.state === "error") ? (
              <p className="mt-2 text-xs text-red-600">
                Some uploads failed. Hover the “failed” badge to see details.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      {/* Gallery */}
      {items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-600">
          No images yet. Upload or drop photos to build the gallery.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => {
            setActiveId(String(e.active.id));
            setOverId(String(e.active.id));
          }}
          onDragOver={(e) => {
            if (!e.over) return;
            setOverId(String(e.over.id));
          }}
          onDragCancel={() => {
            setActiveId(null);
            setOverId(null);
          }}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m, idx) => {
                const willBecomeCover =
                  willSetCoverHint !== null && overId !== null && idx === 0 && overId === m.id;

                return (
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
                    willBecomeCover={willBecomeCover}
                    onToggleExpanded={() =>
                      setExpandedUrlIdx((cur) => (cur === idx ? null : idx))
                    }
                    onCopy={() => void copyUrl(idx, m.url)}
                    onRemove={() => void removeAt(idx)}
                    onMoveUp={() => moveUp(idx)}
                    onMoveDown={() => moveDown(idx)}
                    onSetCover={() => setAsCover(idx)}
                  />
                );
              })}
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
