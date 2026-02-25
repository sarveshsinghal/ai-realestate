// components/lead-match/ExpandableRowDrawer.tsx
"use client";

import { useMemo, useState } from "react";
import type { LeadMatchResult, MatchReason } from "./types";
import ReasonChips from "./ui/ReasonChips";

type TabKey = "REASONS" | "SCORES" | "DEBUG";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function tierFromOverall(v: number) {
  if (v >= 0.8) return { label: "High", hint: "Strong fit on both structured + semantic signals." };
  if (v >= 0.6) return { label: "Medium", hint: "Good fit, but review mismatches before sharing." };
  return { label: "Low", hint: "Weak fit—likely missing requirements or mismatching constraints." };
}

function overallScore(match: LeadMatchResult) {
  // You store `LeadMatch.score` -> mapper sets scores.overall
  if (typeof match.scores.overall === "number") return clamp01(match.scores.overall);

  // fallback only (should rarely be used)
  return clamp01(0.55 * match.scores.structuredScore + 0.45 * match.scores.semanticScore);
}

function splitReasons(reasons: MatchReason[]) {
  const pos = reasons.filter((r) => r.tone === "positive");
  const neg = reasons.filter((r) => r.tone === "negative");
  const neu = reasons.filter((r) => r.tone === "neutral");
  return { pos, neg, neu };
}

export default function ExpandableRowDrawer({
  match,
  onClose,
}: {
  match: LeadMatchResult;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("REASONS");

  const overall = useMemo(() => overallScore(match), [match]);
  const tier = useMemo(() => tierFromOverall(overall), [overall]);

  const freshnessScore = useMemo(() => {
    const v = match.scores.freshnessScore;
    return typeof v === "number" ? clamp01(v) : null;
  }, [match.scores.freshnessScore]);

  const { pos, neg, neu } = useMemo(() => splitReasons(match.reasons ?? []), [match.reasons]);

  return (
    <div className="mt-4 rounded-xl border bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">Match details</div>
          <div className="mt-1 text-xs text-neutral-500">
            Confidence: <span className="font-semibold text-neutral-900">{tier.label}</span>{" "}
            <span className="text-neutral-400">•</span>{" "}
            <span title={tier.hint}>{tier.hint}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TabButton active={tab === "REASONS"} onClick={() => setTab("REASONS")}>
            Reasons
          </TabButton>
          <TabButton active={tab === "SCORES"} onClick={() => setTab("SCORES")}>
            Scores
          </TabButton>
          <TabButton active={tab === "DEBUG"} onClick={() => setTab("DEBUG")}>
            Debug
          </TabButton>

          <button
            onClick={onClose}
            className="ml-0 md:ml-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Collapse
          </button>
        </div>
      </div>

      <div className="mt-4">
        {tab === "REASONS" ? (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-neutral-700">Highlights</div>
              <div className="mt-2">
                <ReasonChips reasons={match.reasons ?? []} max={999} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <ReasonPanel title="Matches" tone="positive" reasons={pos} emptyText="No strong positives detected." />
              <ReasonPanel title="Mismatches" tone="negative" reasons={neg} emptyText="No clear mismatches detected." />
              <ReasonPanel title="Unknown / neutral" tone="neutral" reasons={neu} emptyText="No neutral signals." />
            </div>

            <div className="text-xs text-neutral-500">
              Keep this human-readable. Use Debug for raw JSON and internal details.
            </div>
          </div>
        ) : null}

        {tab === "SCORES" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Metric label="Overall score" value={overall} emphasis />
              <Metric label="Structured score" value={match.scores.structuredScore} />
              <Metric label="Semantic score" value={match.scores.semanticScore} />
              {freshnessScore != null ? (
                <Metric label="Freshness score" value={freshnessScore} />
              ) : (
                <Metric label="Freshness score" value={0} muted footnote="Not available" />
              )}
            </div>

            <div className="rounded-lg border bg-neutral-50 p-3 text-sm text-neutral-700">
              <div className="text-xs font-semibold text-neutral-800">How to read this</div>
              <ul className="mt-2 list-disc pl-5 text-xs text-neutral-600 space-y-1">
                <li>
                  <span className="font-medium text-neutral-800">Structured</span> = hard preference fit (budget, beds,
                  communes, amenities).
                </li>
                <li>
                  <span className="font-medium text-neutral-800">Semantic</span> = how well the listing description
                  matches intent.
                </li>
                <li>
                  <span className="font-medium text-neutral-800">Freshness</span> = recency/availability signal (if
                  provided).
                </li>
              </ul>
            </div>
          </div>
        ) : null}

        {tab === "DEBUG" ? (
          <div className="space-y-3">
            <MetricText label="scope (usedWhereMode)" value={match.usedWhereMode ?? "—"} />

            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-xs font-medium text-neutral-700">reasons (raw)</div>
              <pre className="mt-2 overflow-auto text-xs text-neutral-800">
                {JSON.stringify((match.meta as any)?.reasons ?? null, null, 2)}
              </pre>
            </div>

            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-xs font-medium text-neutral-700">meta</div>
              <pre className="mt-2 overflow-auto text-xs text-neutral-800">
                {JSON.stringify(match.meta ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-md px-3 py-2 text-sm font-medium",
        active ? "bg-neutral-900 text-white" : "border hover:bg-neutral-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Metric({
  label,
  value,
  emphasis,
  muted,
  footnote,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  muted?: boolean;
  footnote?: string;
}) {
  const v = clamp01(value);
  const pct = Math.round(v * 100);

  return (
    <div className={["rounded-lg border p-3", muted ? "bg-neutral-50" : "bg-white"].join(" ")}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-neutral-700">{label}</div>
        {footnote ? <div className="text-[11px] text-neutral-500">{footnote}</div> : null}
      </div>

      <div className={["mt-2 text-lg font-semibold", emphasis ? "text-neutral-900" : "text-neutral-800"].join(" ")}>
        {pct}%
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full bg-neutral-900" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-1 text-xs text-neutral-500">{v.toFixed(3)}</div>
    </div>
  );
}

function MetricText({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium text-neutral-700">{label}</div>
      <div className="mt-2 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function ReasonPanel({
  title,
  tone,
  reasons,
  emptyText,
}: {
  title: string;
  tone: "positive" | "negative" | "neutral";
  reasons: MatchReason[];
  emptyText: string;
}) {
  const headerCls =
    tone === "positive"
      ? "text-emerald-900"
      : tone === "negative"
      ? "text-rose-900"
      : "text-neutral-800";

  const boxCls =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50/40"
      : tone === "negative"
      ? "border-rose-200 bg-rose-50/40"
      : "border-neutral-200 bg-neutral-50/60";

  return (
    <div className={["rounded-lg border p-3", boxCls].join(" ")}>
      <div className={["text-xs font-semibold", headerCls].join(" ")}>{title}</div>
      <div className="mt-2 space-y-1.5">
        {reasons.length === 0 ? (
          <div className="text-xs text-neutral-600">{emptyText}</div>
        ) : (
          reasons.slice(0, 12).map((r, idx) => (
            <div key={`${r.label}-${idx}`} className="text-xs text-neutral-800">
              • {r.label}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
