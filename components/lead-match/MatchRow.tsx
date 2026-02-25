// components/lead-match/MatchRow.tsx
"use client";

import { useMemo, useState } from "react";
import type { LeadMatchResult } from "./types";
import ScoreBadge from "./ui/ScoreBadge";
import ScoreBreakdownBar from "./ui/ScoreBreakdownBar";
import ReasonChips from "./ui/ReasonChips";
import ExpandableRowDrawer from "./ExpandableRowDrawer";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function money(n?: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-LU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function overall(m: LeadMatchResult) {
  // You store LeadMatch.score -> mapper should set scores.overall
  if (typeof m.scores.overall === "number") return clamp01(m.scores.overall);

  // fallback only
  return clamp01(0.55 * m.scores.structuredScore + 0.45 * m.scores.semanticScore);
}

export default function MatchRow({ match, rank }: { match: LeadMatchResult; rank: number }) {
  const [open, setOpen] = useState(false);
  const overallScore = useMemo(() => overall(match), [match]);

  const hasFreshness = typeof match.scores.freshnessScore === "number";

  return (
    <div className="px-4 py-3 hover:bg-neutral-50/60 transition-colors">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left: primary scan */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-xs font-semibold text-neutral-800">
              {rank}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-semibold text-neutral-900">{match.title}</div>
                {match.status ? (
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      match.status === "PUBLISHED"
                        ? "bg-neutral-100 text-neutral-800"
                        : "bg-amber-100 text-amber-900",
                    ].join(" ")}
                  >
                    {match.status}
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-600">
                <span className="truncate">{match.locationLine ?? "—"}</span>
                <span className="text-neutral-300">•</span>
                <span>{money(match.price)}</span>
                <span className="text-neutral-300">•</span>
                <span>{match.bedrooms ?? "—"} bd</span>
                <span className="text-neutral-300">•</span>
                <span>{match.sizeSqm ?? "—"} m²</span>
              </div>
            </div>
          </div>

          {/* Reasons line */}
          <div className="mt-3">
            <ReasonChips reasons={match.reasons ?? []} max={3} onMore={() => setOpen(true)} />
          </div>
        </div>

        {/* Right: score + actions */}
        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="min-w-[240px]">
            <div className="flex items-center justify-end gap-2">
              <ScoreBadge value={overallScore} />
              <span
                className="text-xs text-neutral-500"
                title={hasFreshness ? "Structured / Semantic / Freshness" : "Structured / Semantic"}
              >
                Breakdown
              </span>
            </div>

            <div className="mt-2">
              <ScoreBreakdownBar
                structured={match.scores.structuredScore}
                semantic={match.scores.semanticScore}
                freshness={match.scores.freshnessScore ?? null}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/agency/listings/${match.listingId}`}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-white"
            >
              View
            </a>

            <button className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-white">Shortlist</button>

            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {open ? "Close" : "Explain"}
            </button>
          </div>
        </div>
      </div>

      {open ? <ExpandableRowDrawer match={match} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
