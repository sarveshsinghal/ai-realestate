// app/agency/listings/ListingsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ListingLifecycle = "ACTIVE" | "SOLD" | "UNAVAILABLE" | "ARCHIVED";
type BoostLevel = "BASIC" | "PREMIUM" | "PLATINUM";

type Row = {
  id: string;
  title: string | null;
  price: number | null;
  isPublished: boolean;
  createdAt: Date;

  commune: string;
  sizeSqm: number;
  bedrooms: number;
  kind: string;
  propertyType: string;

  // ✅ lifecycle
  status: ListingLifecycle;
  soldAt?: Date | string | null;
  archivedAt?: Date | string | null;
  soldReason?: string | null;

  // ✅ boost (NEW)
  boost?: {
    level: BoostLevel;
    startsAt: Date | string;
    endsAt: Date | string;
  } | null;

  media: { url: string; sortOrder: number }[];

  _count?: { leads?: number };
};

function formatEUR(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function safeDate(d: unknown): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(String(d));
  return Number.isNaN(+dt) ? null : dt;
}

function isBoostActive(boost: Row["boost"]) {
  const ends = safeDate(boost?.endsAt);
  if (!ends) return false;
  return ends.getTime() > Date.now();
}

function boostPillTone(level: BoostLevel) {
  if (level === "PLATINUM") return "border-purple-200 bg-purple-50 text-purple-900";
  if (level === "PREMIUM") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-sky-200 bg-sky-50 text-sky-900";
}

type ToastTone = "success" | "error" | "info";
type ToastItem = {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
  createdAt: number;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

type PublishState = {
  publishedById: Record<string, boolean>;
  setPublished: (id: string, v: boolean) => void;

  // ✅ lifecycle local store
  lifecycleById: Record<string, ListingLifecycle>;
  setLifecycle: (id: string, v: ListingLifecycle) => void;

  // optional soldReason store for optimistic UI
  soldReasonById: Record<string, string | null | undefined>;
  setSoldReason: (id: string, v: string | null | undefined) => void;

  // ✅ boost local store
  boostById: Record<string, Row["boost"]>;
  setBoost: (id: string, v: Row["boost"]) => void;

  loadingById: Record<string, boolean>;
  setLoading: (id: string, v: boolean) => void;

  toast: (t: Omit<ToastItem, "id" | "createdAt">) => void;
};

function lifecycleLabel(s: ListingLifecycle) {
  if (s === "ACTIVE") return "Active";
  if (s === "SOLD") return "Sold";
  if (s === "UNAVAILABLE") return "Unavailable";
  return "Archived";
}

async function apiBoostApply(listingId: string, level: BoostLevel, days: number) {
  const res = await fetch(`/api/agency/listings/${listingId}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level, days }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiBoostRemove(listingId: string) {
  const res = await fetch(`/api/agency/listings/${listingId}/boost`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ListingsClient({
  listings,
  canCreate,
}: {
  listings: Row[];
  canCreate: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");

  // ✅ lifecycle filter
  const [lifecycle, setLifecycle] = useState<
    "ALL" | "ACTIVE" | "SOLD" | "UNAVAILABLE" | "ARCHIVED"
  >("ALL");

  const [sort, setSort] = useState<"NEWEST" | "OLDEST" | "PRICE_HIGH" | "PRICE_LOW">("NEWEST");
  const [selected, setSelected] = useState<Row | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimers = useRef<Record<string, number>>({});

  const toast = (t: Omit<ToastItem, "id" | "createdAt">) => {
    const id = uid();
    const item: ToastItem = { id, createdAt: Date.now(), ...t };
    setToasts((prev) => [item, ...prev].slice(0, 4));

    const ms = t.tone === "error" ? 4500 : 2800;
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      delete toastTimers.current[id];
    }, ms);

    toastTimers.current[id] = timer;
  };

  useEffect(() => {
    return () => {
      for (const k of Object.keys(toastTimers.current)) {
        window.clearTimeout(toastTimers.current[k]);
      }
    };
  }, []);

  // Local store so toggles update UI immediately
  const [publishedById, setPublishedById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(listings.map((l) => [l.id, Boolean(l.isPublished)]))
  );

  // ✅ lifecycle local store
  const [lifecycleById, setLifecycleById] = useState<Record<string, ListingLifecycle>>(() =>
    Object.fromEntries(listings.map((l) => [l.id, l.status ?? "ACTIVE"]))
  );

  const [soldReasonById, setSoldReasonById] = useState<Record<string, string | null | undefined>>(
    () => Object.fromEntries(listings.map((l) => [l.id, l.soldReason ?? null]))
  );

  // ✅ boost local store
  const [boostById, setBoostById] = useState<Record<string, Row["boost"]>>(() =>
    Object.fromEntries(listings.map((l) => [l.id, l.boost ?? null]))
  );

  // Row-level loading store
  const [loadingById, setLoadingById] = useState<Record<string, boolean>>({});

  // Sync from server refresh / navigation changes
  useEffect(() => {
    setPublishedById((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const l of listings) next[l.id] = Boolean(l.isPublished);
      return next;
    });

    setLifecycleById((prev) => {
      const next: Record<string, ListingLifecycle> = { ...prev };
      for (const l of listings) next[l.id] = (l.status ?? "ACTIVE") as ListingLifecycle;
      return next;
    });

    setSoldReasonById((prev) => {
      const next: Record<string, string | null | undefined> = { ...prev };
      for (const l of listings) next[l.id] = l.soldReason ?? null;
      return next;
    });

    setBoostById((prev) => {
      const next: Record<string, Row["boost"]> = { ...prev };
      for (const l of listings) next[l.id] = l.boost ?? null;
      return next;
    });
  }, [listings]);

  const publishState: PublishState = useMemo(
    () => ({
      publishedById,
      setPublished: (id, v) => setPublishedById((m) => ({ ...m, [id]: v })),

      lifecycleById,
      setLifecycle: (id, v) => setLifecycleById((m) => ({ ...m, [id]: v })),

      soldReasonById,
      setSoldReason: (id, v) => setSoldReasonById((m) => ({ ...m, [id]: v })),

      boostById,
      setBoost: (id, v) => setBoostById((m) => ({ ...m, [id]: v })),

      loadingById,
      setLoading: (id, v) => setLoadingById((m) => ({ ...m, [id]: v })),
      toast,
    }),
    [publishedById, lifecycleById, soldReasonById, boostById, loadingById]
  );

  // One source of truth for “effective” publish state
  const effectivePublished = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const l of listings) {
      const v =
        typeof publishedById[l.id] === "boolean" ? publishedById[l.id] : Boolean(l.isPublished);
      map.set(l.id, v);
    }
    return map;
  }, [listings, publishedById]);

  // ✅ effective lifecycle
  const effectiveLifecycle = useMemo(() => {
    const map = new Map<string, ListingLifecycle>();
    for (const l of listings) {
      const v = typeof lifecycleById[l.id] === "string" ? lifecycleById[l.id] : l.status ?? "ACTIVE";
      map.set(l.id, v as ListingLifecycle);
    }
    return map;
  }, [listings, lifecycleById]);

  // ✅ effective boost
  const effectiveBoost = useMemo(() => {
    const map = new Map<string, Row["boost"]>();
    for (const l of listings) {
      const v = Object.prototype.hasOwnProperty.call(boostById, l.id) ? boostById[l.id] : l.boost ?? null;
      map.set(l.id, v ?? null);
    }
    return map;
  }, [listings, boostById]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let rows = listings.slice();

    const isPub = (id: string, fallback: boolean) => effectivePublished.get(id) ?? fallback;
    const life = (id: string, fallback: ListingLifecycle) =>
      (effectiveLifecycle.get(id) ?? fallback) as ListingLifecycle;

    if (status !== "ALL") {
      rows = rows.filter((r) =>
        status === "PUBLISHED" ? isPub(r.id, r.isPublished) : !isPub(r.id, r.isPublished)
      );
    }

    if (lifecycle !== "ALL") {
      rows = rows.filter((r) => life(r.id, r.status) === lifecycle);
    }

    if (query) {
      rows = rows.filter((r) => {
        const t = (r.title ?? "").toLowerCase();
        const c = (r.commune ?? "").toLowerCase();
        const pt = (r.propertyType ?? "").toLowerCase();
        const k = (r.kind ?? "").toLowerCase();
        return t.includes(query) || c.includes(query) || pt.includes(query) || k.includes(query);
      });
    }

    rows.sort((a, b) => {
      if (sort === "NEWEST") return +new Date(b.createdAt) - +new Date(a.createdAt);
      if (sort === "OLDEST") return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (sort === "PRICE_HIGH") return (b.price ?? 0) - (a.price ?? 0);
      return (a.price ?? 0) - (b.price ?? 0);
    });

    return rows;
  }, [listings, q, status, lifecycle, sort, effectivePublished, effectiveLifecycle]);

  const hasFilters =
    q.trim().length > 0 || status !== "ALL" || lifecycle !== "ALL" || sort !== "NEWEST";

  function clearFilters() {
    setQ("");
    setStatus("ALL");
    setLifecycle("ALL");
    setSort("NEWEST");
  }

  // ESC closes drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep drawer selection in sync with effective publish/lifecycle/boost changes
  useEffect(() => {
    const id = selected?.id;
    if (!id) return;

    const pub = effectivePublished.get(id);
    const life = effectiveLifecycle.get(id);
    const soldReason = soldReasonById[id] ?? null;
    const boost = effectiveBoost.get(id) ?? null;

    setSelected((prev) => {
        if (!prev) return prev;
        if (prev.id !== id) return prev;

        let changed = false;
        const next = { ...prev };

        if (typeof pub === "boolean" && pub !== prev.isPublished) {
            next.isPublished = pub;
            changed = true;
        }

        if (life && life !== prev.status) {
            next.status = life;
            changed = true;
        }

        const sr = soldReason ?? null;
        if (sr !== (prev.soldReason ?? null)) {
            next.soldReason = sr;
            changed = true;
        }

        // ✅ boost sync (deep-compare via JSON; ok because boost is tiny)
        const prevBoostJson = JSON.stringify((prev as any).boost ?? null);
        const nextBoostJson = JSON.stringify(boost);
        if (prevBoostJson !== nextBoostJson) {
            (next as any).boost = boost;
            changed = true;
        }
        return changed ? next : prev; // ✅ prevents infinite loop
    });

  }, [selected?.id, effectivePublished, effectiveLifecycle, soldReasonById, effectiveBoost]);

  return (
    <div className="space-y-4">
      <ToastStack items={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((x) => x.id !== id))} />

      {/* Toolbar */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full md:max-w-md">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, commune, kind, property type…"
                className="w-full rounded-xl border bg-white px-3 py-2 pl-9 text-sm outline-none ring-0 focus:border-neutral-300"
              />
              <span className="absolute left-3 top-2.5 text-sm text-neutral-400">⌕</span>
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="rounded-xl border bg-white px-3 py-2 text-sm"
              aria-label="Publish status"
            >
              <option value="ALL">All</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>

            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value as any)}
              className="rounded-xl border bg-white px-3 py-2 text-sm"
              aria-label="Lifecycle"
              title="Lifecycle status"
            >
              <option value="ALL">Lifecycle: All</option>
              <option value="ACTIVE">Active</option>
              <option value="SOLD">Sold</option>
              <option value="UNAVAILABLE">Unavailable</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="rounded-xl border bg-white px-3 py-2 text-sm"
              aria-label="Sort"
            >
              <option value="NEWEST">Newest</option>
              <option value="OLDEST">Oldest</option>
              <option value="PRICE_HIGH">Price: high → low</option>
              <option value="PRICE_LOW">Price: low → high</option>
            </select>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="hidden rounded-xl border bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 md:inline-flex"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 md:justify-end">
            <div className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">{filtered.length}</span> results
            </div>

            {canCreate ? (
              <Link
                href="/agency/listings/new"
                className="hidden rounded-xl border bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 md:inline-flex"
              >
                Create
              </Link>
            ) : null}
          </div>
        </div>

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
            <span className="rounded-full border bg-neutral-50 px-2 py-1">
              Publish: <span className="font-medium text-neutral-900">{status}</span>
            </span>
            <span className="rounded-full border bg-neutral-50 px-2 py-1">
              Lifecycle: <span className="font-medium text-neutral-900">{lifecycle}</span>
            </span>
            <span className="rounded-full border bg-neutral-50 px-2 py-1">
              Sort: <span className="font-medium text-neutral-900">{sort}</span>
            </span>
            {q.trim() ? (
              <span className="rounded-full border bg-neutral-50 px-2 py-1">
                Query: <span className="font-medium text-neutral-900">“{q.trim()}”</span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border bg-white px-3 py-1 font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      {/* List / empty states */}
      {filtered.length === 0 ? (
        <ListingsEmptyState canCreate={canCreate} hasSearch={q.trim().length > 0} status={status} onClear={clearFilters} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="divide-y">
            {filtered.map((l) => {
              const effectivePub = effectivePublished.get(l.id) ?? Boolean(l.isPublished);
              const effectiveLife = (effectiveLifecycle.get(l.id) ?? l.status) as ListingLifecycle;
              const effectiveBst = effectiveBoost.get(l.id) ?? l.boost ?? null;
              const busy = Boolean(loadingById[l.id]);

              return (
                <ListingRow
                  key={l.id}
                  row={{ ...l, isPublished: effectivePub, status: effectiveLife, boost: effectiveBst }}
                  busy={busy}
                  onOpen={() =>
                    setSelected({
                      ...l,
                      isPublished: effectivePub,
                      status: effectiveLife,
                      soldReason: soldReasonById[l.id] ?? l.soldReason ?? null,
                      boost: effectiveBst,
                    } as Row)
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Drawer */}
      <PreviewDrawer row={selected} onClose={() => setSelected(null)} publishState={publishState} />
    </div>
  );
}

function ListingRow({
  row,
  busy,
  onOpen,
}: {
  row: Row;
  busy: boolean;
  onOpen: () => void;
}) {
  const thumb = row.media?.[0]?.url ?? null;
  const leadCount = row._count?.leads ?? 0;

  const boostActive = isBoostActive(row.boost);
  const boostEnds = safeDate(row.boost?.endsAt);

  return (
    <div
      className={[
        "group px-4 py-4 transition-colors",
        busy ? "bg-neutral-50/40" : "hover:bg-neutral-50/60 cursor-pointer",
      ].join(" ")}
      onClick={() => {
        if (!busy) onOpen();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (busy) return;
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      aria-disabled={busy}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl border bg-neutral-100">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  className={["h-full w-full object-cover", busy ? "opacity-70" : ""].join(" ")}
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                  No photo
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-semibold text-neutral-900">
                  {row.title ?? "(Untitled)"}
                </div>

                <StatusPill published={row.isPublished} />
                <LifecyclePill status={row.status} />

                {/* ✅ boost pill */}
                {boostActive && row.boost ? (
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-xs font-semibold",
                      boostPillTone(row.boost.level),
                    ].join(" ")}
                    title={boostEnds ? `Boost active until ${formatDate(boostEnds)}` : "Boost active"}
                  >
                    🔥 {row.boost.level}
                    {boostEnds ? ` • until ${formatDate(boostEnds)}` : ""}
                  </span>
                ) : row.boost ? (
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    Boost ended
                  </span>
                ) : null}

                {busy ? (
                  <span className="rounded-full border bg-white px-2 py-0.5 text-xs font-medium text-neutral-700">
                    Updating…
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-600">
                <span className="truncate">{row.commune}</span>
                <span className="text-neutral-300">•</span>
                <span>{formatEUR(row.price)}</span>
                <span className="text-neutral-300">•</span>
                <span>{row.bedrooms} bd</span>
                <span className="text-neutral-300">•</span>
                <span>{row.sizeSqm} m²</span>
                <span className="text-neutral-300">•</span>
                <span className="uppercase text-xs tracking-wide text-neutral-500">{row.kind}</span>
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                Created {formatDate(new Date(row.createdAt))}
              </div>
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 md:justify-end" onClick={(e) => e.stopPropagation()}>
          <Link
            href={busy ? "#" : `/agency/listings/${row.id}/edit`}
            aria-disabled={busy}
            onClick={(e) => {
              if (busy) e.preventDefault();
            }}
            className={[
              "rounded-lg border bg-white px-3 py-2 text-sm font-medium text-neutral-900",
              busy ? "opacity-60 cursor-not-allowed" : "hover:bg-neutral-50",
            ].join(" ")}
          >
            Edit
          </Link>

          <Link
            href={busy ? "#" : `/listing/${row.id}`}
            aria-disabled={busy}
            onClick={(e) => {
              if (busy) e.preventDefault();
            }}
            className={[
              "rounded-lg border bg-white px-3 py-2 text-sm font-medium text-neutral-900",
              busy ? "opacity-60 cursor-not-allowed" : "hover:bg-neutral-50",
            ].join(" ")}
          >
            View
          </Link>

          <Link
            href={busy ? "#" : `/agency/leads?listingId=${row.id}`}
            aria-disabled={busy}
            onClick={(e) => {
              if (busy) e.preventDefault();
            }}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              leadCount > 0 ? "bg-neutral-900 text-white hover:bg-neutral-800" : "border bg-white text-neutral-900 hover:bg-neutral-50",
              busy ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            Leads
            {leadCount > 0 ? (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs tabular-nums">{leadCount}</span>
            ) : null}
          </Link>
        </div>
      </div>
    </div>
  );
}

function PreviewDrawer({
  row,
  onClose,
  publishState,
}: {
  row: Row | null;
  onClose: () => void;
  publishState: PublishState;
}) {
  const open = Boolean(row);
  const leadCount = row?._count?.leads ?? 0;
  const thumb = row?.media?.[0]?.url ?? null;

  const effectiveStatus = row ? publishState.lifecycleById[row.id] ?? row.status : null;

  const currentSoldReason = row ? publishState.soldReasonById[row.id] ?? row.soldReason ?? "" : "";

  const effectiveBoost = row ? publishState.boostById[row.id] ?? row.boost ?? null : null;

  return (
    <div className={["fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none"].join(" ")} aria-hidden={!open}>
      <div
        className={["absolute inset-0 bg-black/30 transition-opacity", open ? "opacity-100" : "opacity-0"].join(" ")}
        onClick={onClose}
      />

      <div
        className={[
          "absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-900">{row?.title ?? "Listing"}</div>
              <div className="mt-1 flex items-center gap-2">
                {row ? <StatusPill published={row.isPublished} /> : null}
                {row && effectiveStatus ? <LifecyclePill status={effectiveStatus as ListingLifecycle} /> : null}
                {effectiveBoost && isBoostActive(effectiveBoost) ? (
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-xs font-semibold",
                      boostPillTone(effectiveBoost.level),
                    ].join(" ")}
                  >
                    🔥 {effectiveBoost.level}
                  </span>
                ) : null}
                <span className="text-xs text-neutral-500">{row ? `Created ${formatDate(new Date(row.createdAt))}` : ""}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {row ? <PublishToggle row={row} publishState={publishState} /> : null}
              <button onClick={onClose} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            <div className="overflow-hidden rounded-2xl border bg-neutral-50">
              <div className="aspect-[16/10] w-full bg-neutral-100">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">No photo</div>
                )}
              </div>

              <div className="p-4">
                <div className="text-xl font-semibold text-neutral-900">{formatEUR(row?.price ?? null)}</div>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-700">
                  <span>{row?.commune ?? "—"}</span>
                  <span className="text-neutral-300">•</span>
                  <span>{row?.bedrooms ?? "—"} bd</span>
                  <span className="text-neutral-300">•</span>
                  <span>{row?.sizeSqm ?? "—"} m²</span>
                  <span className="text-neutral-300">•</span>
                  <span className="uppercase text-xs tracking-wide text-neutral-500">{row?.kind ?? ""}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Leads" value={leadCount} />
                  <Metric label="Property type" value={row?.propertyType ?? "—"} />
                </div>
              </div>
            </div>

            {/* ✅ Boost controls (NEW) */}
            {row ? <BoostControls row={row} publishState={publishState} /> : null}

            {/* ✅ Lifecycle controls */}
            {row ? (
              <LifecycleControls row={row} publishState={publishState} currentSoldReason={currentSoldReason} />
            ) : null}
          </div>

          <div className="border-t px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={row ? `/agency/listings/${row.id}/edit` : "#"}
                className="flex-1 rounded-xl bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-neutral-800"
                onClick={() => onClose()}
              >
                Edit
              </Link>
              <Link
                href={row ? `/listing/${row.id}` : "#"}
                className="flex-1 rounded-xl border bg-white px-4 py-2 text-center text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                onClick={() => onClose()}
              >
                View
              </Link>
              <Link
                href={row ? `/agency/leads?listingId=${row.id}` : "#"}
                className="flex-1 rounded-xl border bg-white px-4 py-2 text-center text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                onClick={() => onClose()}
              >
                Leads
              </Link>
            </div>

            <div className="mt-2 text-xs text-neutral-500">
              Tip: Press <span className="font-medium">Esc</span> to close.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoostControls({ row, publishState }: { row: Row; publishState: PublishState }) {
  const loading = Boolean(publishState.loadingById[row.id]);

  const boost = publishState.boostById[row.id] ?? row.boost ?? null;
  const active = isBoostActive(boost);
  const ends = safeDate(boost?.endsAt);

  const [level, setLevel] = useState<BoostLevel>((boost?.level ?? "BASIC") as BoostLevel);
  const [days, setDays] = useState<number>(14);

  useEffect(() => {
    const current = (publishState.boostById[row.id] ?? row.boost ?? null) as Row["boost"];
    setLevel(((current?.level ?? "BASIC") as BoostLevel) || "BASIC");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  async function apply() {
    if (loading) return;

    const prev = publishState.boostById[row.id] ?? row.boost ?? null;

    publishState.setLoading(row.id, true);

    // optimistic: set local boost with an estimated end date immediately
    const now = new Date();
    const optimisticEnds = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    publishState.setBoost(row.id, { level, startsAt: now, endsAt: optimisticEnds });

    try {
      const data = await apiBoostApply(row.id, level, days);
      const b = data?.boost;
      if (!b) throw new Error("Boost response missing.");

      publishState.setBoost(row.id, {
        level: b.level as BoostLevel,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
      });

      publishState.toast({
        tone: "success",
        title: "Boost applied",
        message: `${level} boost active for ${days} days.`,
      });
    } catch (e: any) {
      publishState.setBoost(row.id, prev);
      publishState.toast({
        tone: "error",
        title: "Couldn’t apply boost",
        message: e?.message ?? "We reverted the change. Please try again.",
      });
    } finally {
      publishState.setLoading(row.id, false);
    }
  }

  async function remove() {
    if (loading) return;

    const prev = publishState.boostById[row.id] ?? row.boost ?? null;

    publishState.setLoading(row.id, true);
    publishState.setBoost(row.id, null);

    try {
      await apiBoostRemove(row.id);

      publishState.toast({
        tone: "success",
        title: "Boost removed",
        message: "This listing is no longer promoted.",
      });
    } catch (e: any) {
      publishState.setBoost(row.id, prev);
      publishState.toast({
        tone: "error",
        title: "Couldn’t remove boost",
        message: e?.message ?? "We reverted the change. Please try again.",
      });
    } finally {
      publishState.setLoading(row.id, false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">Boost (Promoted)</div>
          <p className="mt-1 text-sm text-neutral-600">
            Boost increases visibility in Recommended and gives a small lift in search.
          </p>
        </div>

        {active && boost ? (
          <span className={["shrink-0 rounded-full border px-2 py-1 text-xs font-semibold", boostPillTone(boost.level)].join(" ")}>
            🔥 {boost.level}
            {ends ? ` • until ${formatDate(ends)}` : ""}
          </span>
        ) : boost ? (
          <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
            Boost ended
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
            Not boosted
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-2">
        <label className="text-xs font-medium text-neutral-700">Level</label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as BoostLevel)}
          className="rounded-xl border bg-white px-3 py-2 text-sm"
          disabled={loading}
        >
          <option value="BASIC">BASIC</option>
          <option value="PREMIUM">PREMIUM</option>
          <option value="PLATINUM">PLATINUM</option>
        </select>

        <label className="mt-2 text-xs font-medium text-neutral-700">Duration</label>
        <select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-xl border bg-white px-3 py-2 text-sm"
          disabled={loading}
        >
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
        </select>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={loading}
            className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Apply boost"}
          </button>

          <button
            type="button"
            onClick={remove}
            disabled={loading || !boost}
            className="rounded-xl border bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function LifecycleControls({
  row,
  publishState,
  currentSoldReason,
}: {
  row: Row;
  publishState: PublishState;
  currentSoldReason: string;
}) {
  const loading = Boolean(publishState.loadingById[row.id]);

  const current = (publishState.lifecycleById[row.id] ?? row.status) as ListingLifecycle;

  const [nextStatus, setNextStatus] = useState<ListingLifecycle>(current);
  const [reason, setReason] = useState<string>(currentSoldReason ?? "");

  useEffect(() => {
    setNextStatus((publishState.lifecycleById[row.id] ?? row.status) as ListingLifecycle);
    setReason((publishState.soldReasonById[row.id] ?? row.soldReason ?? "") as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  async function apply() {
    if (loading) return;

    const prevStatus = current;
    const prevReason = publishState.soldReasonById[row.id] ?? row.soldReason ?? null;

    publishState.setLoading(row.id, true);
    publishState.setLifecycle(row.id, nextStatus);
    publishState.setSoldReason(row.id, reason.trim() ? reason.trim() : null);

    try {
      const fd = new FormData();
      fd.set("status", nextStatus);
      if (reason.trim()) fd.set("soldReason", reason.trim());

      const res = await fetch(`/api/listings/${row.id}/status`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        publishState.setLifecycle(row.id, prevStatus);
        publishState.setSoldReason(row.id, prevReason);

        publishState.toast({
          tone: "error",
          title: "Couldn’t update lifecycle",
          message: "We reverted the change. Please try again.",
        });
        return;
      }

      publishState.toast({
        tone: "success",
        title: "Lifecycle updated",
        message: `Set to ${lifecycleLabel(nextStatus)}.`,
      });
    } catch {
      publishState.setLifecycle(row.id, prevStatus);
      publishState.setSoldReason(row.id, prevReason);

      publishState.toast({
        tone: "error",
        title: "Network error",
        message: "We reverted the change. Check your connection and retry.",
      });
    } finally {
      publishState.setLoading(row.id, false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm font-semibold text-neutral-900">Lifecycle</div>
      <p className="mt-1 text-sm text-neutral-600">
        Use this to mark Sold/Unavailable and keep the public experience accurate.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <label className="text-xs font-medium text-neutral-700">Status</label>
        <select
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value as ListingLifecycle)}
          className="rounded-xl border bg-white px-3 py-2 text-sm"
          disabled={loading}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="SOLD">SOLD</option>
          <option value="UNAVAILABLE">UNAVAILABLE</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>

        <label className="mt-2 text-xs font-medium text-neutral-700">Reason (optional)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='e.g. "sold", "rented", "withdrawn"'
          className="rounded-xl border bg-white px-3 py-2 text-sm"
          disabled={loading}
        />

        <button
          type="button"
          onClick={apply}
          disabled={loading}
          className={[
            "mt-3 rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-60",
            "bg-neutral-900 text-white hover:bg-neutral-800",
          ].join(" ")}
        >
          {loading ? "Updating..." : "Update lifecycle"}
        </button>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        {safeDate(row.soldAt) ? <div>Sold at: {safeDate(row.soldAt)!.toLocaleString("de-LU")}</div> : null}
        {safeDate(row.archivedAt) ? <div>Archived at: {safeDate(row.archivedAt)!.toLocaleString("de-LU")}</div> : null}
      </div>
    </div>
  );
}

function PublishToggle({ row, publishState }: { row: Row; publishState: PublishState }) {
  const loading = Boolean(publishState.loadingById[row.id]);

  async function toggle() {
    if (loading) return;

    const current =
      typeof publishState.publishedById[row.id] === "boolean"
        ? publishState.publishedById[row.id]
        : row.isPublished;

    const next = !current;

    publishState.setLoading(row.id, true);
    publishState.setPublished(row.id, next);

    try {
      const res = await fetch(`/api/agency/listings/${row.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: next }),
      });

      if (!res.ok) {
        publishState.setPublished(row.id, current);
        publishState.toast({
          tone: "error",
          title: "Couldn’t update publish status",
          message: "We reverted the change. Please try again.",
        });
        return;
      }

      publishState.toast({
        tone: "success",
        title: next ? "Published" : "Moved to Draft",
        message: next
          ? "This listing is now visible publicly and eligible for matching."
          : "This listing is no longer public and won’t be matched.",
      });
    } catch {
      publishState.setPublished(row.id, current);
      publishState.toast({
        tone: "error",
        title: "Network error",
        message: "We reverted the change. Check your connection and retry.",
      });
    } finally {
      publishState.setLoading(row.id, false);
    }
  }

  const published =
    typeof publishState.publishedById[row.id] === "boolean"
      ? publishState.publishedById[row.id]
      : row.isPublished;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={[
        "rounded-xl px-3 py-2 text-xs font-medium transition disabled:opacity-60",
        published ? "bg-neutral-900 text-white hover:bg-neutral-800" : "border bg-white text-neutral-900 hover:bg-neutral-50",
      ].join(" ")}
      title="Toggle publish status"
    >
      {loading ? "Updating..." : published ? "Unpublish" : "Publish"}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs font-medium text-neutral-600">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function StatusPill({ published }: { published: boolean }) {
  return published ? (
    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
      Published
    </span>
  ) : (
    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
      Draft
    </span>
  );
}

function LifecyclePill({ status }: { status: ListingLifecycle }) {
  const cls =
    status === "ACTIVE"
      ? "border-green-200 bg-green-50 text-green-800"
      : status === "SOLD"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "UNAVAILABLE"
      ? "border-orange-200 bg-orange-50 text-orange-800"
      : "border-neutral-200 bg-neutral-50 text-neutral-700";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {lifecycleLabel(status)}
    </span>
  );
}

function ListingsEmptyState({
  canCreate,
  hasSearch,
  status,
  onClear,
}: {
  canCreate: boolean;
  hasSearch: boolean;
  status: "ALL" | "PUBLISHED" | "DRAFT";
  onClear: () => void;
}) {
  const title =
    status === "DRAFT"
      ? "No drafts yet"
      : status === "PUBLISHED"
      ? "No published listings"
      : hasSearch
      ? "No listings match your search"
      : "No listings yet";

  const subtitle =
    status === "DRAFT"
      ? "Drafts are listings you’ve saved but not published."
      : status === "PUBLISHED"
      ? "Publish a listing to make it visible and eligible for matching."
      : hasSearch
      ? "Try a different keyword or clear the filters."
      : "Create your first listing to start matching leads and powering AI search.";

  return (
    <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border bg-neutral-50 text-xl">
        {status === "DRAFT" ? "📝" : status === "PUBLISHED" ? "🌍" : "📦"}
      </div>

      <h3 className="mt-4 text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          Clear filters
        </button>

        {canCreate ? (
          <Link href="/agency/listings/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            New listing
          </Link>
        ) : null}

        <Link href="/agency/leads" className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
          View leads
        </Link>
      </div>
    </div>
  );
}

function ToastStack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={[
            "rounded-2xl border bg-white p-4 shadow-lg",
            t.tone === "success" ? "border-green-200" : t.tone === "error" ? "border-red-200" : "border-neutral-200",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span>{t.tone === "success" ? "✅" : t.tone === "error" ? "⚠️" : "ℹ️"}</span>
                <div className="truncate text-sm font-semibold text-neutral-900">{t.title}</div>
              </div>

              {t.message ? <div className="mt-1 text-sm text-neutral-600">{t.message}</div> : null}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="rounded-lg border bg-white px-2 py-1 text-xs font-medium text-neutral-900 hover:bg-neutral-50"
              aria-label="Dismiss toast"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}