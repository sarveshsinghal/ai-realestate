// components/lead-match/MatchList.tsx
"use client";

import type { LeadMatchResult, LeadSummary } from "./types";
import MatchRow from "./MatchRow";

export default function MatchList({ lead, matches }: { lead: LeadSummary; matches: LeadMatchResult[] }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-medium text-neutral-900">Ranked matches</div>
        <div className="mt-1 text-xs text-neutral-500">Expand a row for reasons, score details, and debug.</div>
      </div>

      <div className="divide-y">
        {matches.map((m, idx) => (
          <MatchRow key={m.id} match={m} rank={idx + 1} />
        ))}
      </div>
    </div>
  );
}
