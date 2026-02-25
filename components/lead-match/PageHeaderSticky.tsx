// components/lead-match/PageHeaderSticky.tsx
"use client";

import type { LeadSummary } from "./types";
import LeadMetaChips from "./LeadMetaChips";
import StatusPill from "./ui/StatusPill";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function PageHeaderSticky({
  lead,
  onMarkReviewed,
  onToggleFakeLoading,
}: {
  lead: LeadSummary;
  onMarkReviewed: () => void;
  onToggleFakeLoading?: () => void; // dev helper
}) {
  return (
    <div className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="flex min-h-[72px] flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
          {/* Left */}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-lg font-semibold md:text-xl">
                Lead: {lead.displayName ?? lead.id.slice(0, 8)}
              </h1>
              <StatusPill status={lead.status ?? "NEW"} />
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Created {formatDate(lead.createdAt)} {lead.source ? `• Source: ${lead.source}` : ""}
            </div>
          </div>

          {/* Middle chips */}
          <div className="md:flex-1 md:px-4">
            <LeadMetaChips lead={lead} />
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onMarkReviewed}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Mark reviewed
            </button>

            <button
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
              // TODO: wire to shortlist modal
            >
              Shortlist
            </button>

            <button className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50">
              Share
            </button>

            {/* Dev helper */}
            {onToggleFakeLoading ? (
              <button
                onClick={onToggleFakeLoading}
                className="hidden rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50 md:inline-flex"
                title="Dev helper: toggle skeletons"
              >
                Toggle loading
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
