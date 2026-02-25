// components/lead-match/ResultsSummaryStrip.tsx
import type { LeadMatchResult, LeadSummary } from "./types";

function tierFromOverall(overall: number) {
  if (overall >= 0.8) return "HIGH";
  if (overall >= 0.6) return "MEDIUM";
  return "LOW";
}

function getOverall(m: LeadMatchResult) {
  if (typeof m.scores.overall === "number") return m.scores.overall;
  return 0.55 * m.scores.structuredScore + 0.45 * m.scores.semanticScore;
}

export default function ResultsSummaryStrip({ lead, matches }: { lead: LeadSummary; matches: LeadMatchResult[] }) {
  const dist = matches.reduce(
    (acc, m) => {
      const t = tierFromOverall(getOverall(m));
      acc[t]++;
      return acc;
    },
    { HIGH: 0, MEDIUM: 0, LOW: 0 }
  );

  const total = matches.length;

  return (
    <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">{total}</span> matches found
        </div>

        <div className="flex items-center gap-3">
          <MiniDist label="High" value={dist.HIGH} total={total} />
          <MiniDist label="Med" value={dist.MEDIUM} total={total} />
          <MiniDist label="Low" value={dist.LOW} total={total} />
        </div>
      </div>
    </div>
  );
}

function MiniDist({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-600">
      <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-800">{label}</span>
      <span className="font-medium text-neutral-900">{value}</span>
      <span className="text-neutral-500">({pct}%)</span>
    </div>
  );
}
