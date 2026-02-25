// components/lead-match/LeadMatchPage.tsx
"use client";

import { useMemo, useState } from "react";
import type { LeadMatchResult, LeadSummary, MatchSortKey } from "./types";
import PageHeaderSticky from "./PageHeaderSticky";
import LeadProfileCard from "./LeadProfileCard";
import ResultsFilterBar, { type FiltersState } from "./ResultsFilterBar";
import ResultsSummaryStrip from "./ResultsSummaryStrip";
import MatchList from "./MatchList";
import EmptyState from "./ui/EmptyState";
import { MatchesSkeleton } from "./ui/Skeletons";

type Props = {
  lead: LeadSummary;
  matches: LeadMatchResult[];
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function getOverallScore(m: LeadMatchResult): number {
  if (typeof m.scores.overall === "number") return clamp01(m.scores.overall);
  return clamp01(0.55 * m.scores.structuredScore + 0.45 * m.scores.semanticScore);
}

function sortMatches(list: LeadMatchResult[], sort: MatchSortKey) {
  const copy = [...list];
  switch (sort) {
    case "HIGH_SEMANTIC":
      return copy.sort((a, b) => (b.scores.semanticScore ?? 0) - (a.scores.semanticScore ?? 0));
    case "BEST_OVERALL":
      return copy.sort((a, b) => getOverallScore(b) - getOverallScore(a));
    case "BEST_VALUE":
      return copy.sort((a, b) => {
        const av = getOverallScore(a) / Math.max(1, a.price ?? 1);
        const bv = getOverallScore(b) / Math.max(1, b.price ?? 1);
        return bv - av;
      });
    case "NEWEST":
      return copy;
    case "CLOSEST":
      return copy;
    default:
      return copy;
  }
}

function filterMatches(matches: LeadMatchResult[], filters: FiltersState) {
  const q = filters.query.trim().toLowerCase();

  return matches.filter((m) => {
    if (filters.publishedOnly && m.status !== "PUBLISHED") return false;

    const overall = getOverallScore(m);
    if (filters.minConfidenceTier === "HIGH" && overall < 0.8) return false;
    if (filters.minConfidenceTier === "MEDIUM" && overall < 0.6) return false;

    if (q) {
      const hay = `${m.title} ${m.locationLine ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

export default function LeadMatchPage({ lead, matches }: Props) {
  // Dev helper only (you can remove later)
  const [loadingSimulated, setLoadingSimulated] = useState(false);

  const [filters, setFilters] = useState<FiltersState>({
    query: "",
    publishedOnly: true,
    minConfidenceTier: "MEDIUM",
    sort: "BEST_OVERALL",
    quickChip: "BEST_OVERALL",
  });

  const filtered = useMemo(() => filterMatches(matches, filters), [matches, filters]);
  const sorted = useMemo(() => sortMatches(filtered, filters.sort), [filtered, filters.sort]);

  const isLoading = loadingSimulated;

  return (
    <div className="min-h-[calc(100vh-0px)]">
      <PageHeaderSticky
        lead={lead}
        onMarkReviewed={() => {
          // wire mutation later
        }}
        onToggleFakeLoading={() => setLoadingSimulated((v) => !v)}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="grid grid-cols-12 gap-6 py-6">
          {/* Left panel */}
          <aside className="col-span-12 lg:col-span-4 xl:col-span-3">
            <div className="lg:sticky lg:top-[88px] space-y-4">
              <LeadProfileCard lead={lead} />
            </div>
          </aside>

          {/* Right panel */}
          <main className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-4">
            <ResultsFilterBar value={filters} onChange={setFilters} />
            <ResultsSummaryStrip lead={lead} matches={sorted} />

            {isLoading ? (
              <MatchesSkeleton />
            ) : sorted.length === 0 ? (
              <EmptyState
                title="No matches meet these filters"
                description="Try lowering the confidence threshold or including draft listings."
                actionLabel="Reset filters"
                onAction={() =>
                  setFilters({
                    query: "",
                    publishedOnly: true,
                    minConfidenceTier: "MEDIUM",
                    sort: "BEST_OVERALL",
                    quickChip: "BEST_OVERALL",
                  })
                }
              />
            ) : (
              <MatchList lead={lead} matches={sorted} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
