// components/lead-match/ResultsFilterBar.tsx
"use client";

import type { ConfidenceTier, MatchSortKey } from "./types";

export type FiltersState = {
  query: string;
  publishedOnly: boolean;
  minConfidenceTier: ConfidenceTier | "LOW" | "MEDIUM" | "HIGH"; // allow tier selection
  sort: MatchSortKey;
  quickChip: MatchSortKey;
};

export default function ResultsFilterBar({
  value,
  onChange,
}: {
  value: FiltersState;
  onChange: (v: FiltersState) => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left: search + quick chips */}
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-[340px]">
            <input
              value={value.query}
              onChange={(e) => onChange({ ...value, query: e.target.value })}
              placeholder="Search results (title, location)…"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["BEST_OVERALL", "BEST_VALUE", "CLOSEST", "NEWEST", "HIGH_SEMANTIC"] as MatchSortKey[]).map((k) => {
              const active = value.quickChip === k;
              return (
                <button
                  key={k}
                  onClick={() => onChange({ ...value, quickChip: k, sort: k })}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    active ? "bg-neutral-900 text-white border-neutral-900" : "bg-white hover:bg-neutral-50",
                  ].join(" ")}
                >
                  {label(k)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedConfidence
            value={value.minConfidenceTier}
            onChange={(t) => onChange({ ...value, minConfidenceTier: t })}
          />

          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-neutral-50">
            <input
              type="checkbox"
              checked={value.publishedOnly}
              onChange={(e) => onChange({ ...value, publishedOnly: e.target.checked })}
            />
            Published only
          </label>

          <select
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as MatchSortKey })}
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <option value="BEST_OVERALL">Best overall</option>
            <option value="BEST_VALUE">Best value</option>
            <option value="HIGH_SEMANTIC">High semantic</option>
            <option value="NEWEST">Newest</option>
            <option value="CLOSEST">Closest</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function label(k: MatchSortKey) {
  switch (k) {
    case "BEST_OVERALL":
      return "Best overall";
    case "BEST_VALUE":
      return "Best value";
    case "CLOSEST":
      return "Closest";
    case "NEWEST":
      return "Newest";
    case "HIGH_SEMANTIC":
      return "High semantic";
    default:
      return k;
  }
}

function SegmentedConfidence({
  value,
  onChange,
}: {
  value: "LOW" | "MEDIUM" | "HIGH";
  onChange: (v: "LOW" | "MEDIUM" | "HIGH") => void;
}) {
  const items: Array<"LOW" | "MEDIUM" | "HIGH"> = ["LOW", "MEDIUM", "HIGH"];

  return (
    <div className="inline-flex overflow-hidden rounded-md border">
      {items.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={[
              "px-3 py-2 text-sm font-medium",
              active ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50",
            ].join(" ")}
            title="Minimum confidence tier"
          >
            {t === "LOW" ? "Low+" : t === "MEDIUM" ? "Med+" : "High"}
          </button>
        );
      })}
    </div>
  );
}
