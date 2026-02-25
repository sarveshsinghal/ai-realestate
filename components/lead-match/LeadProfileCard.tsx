// components/lead-match/LeadProfileCard.tsx
import type { LeadSummary } from "./types";
import ConfidenceMeter from "./ui/ConfidenceMeter";
import Chip from "./ui/Chip";

export default function LeadProfileCard({ lead }: { lead: LeadSummary }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-neutral-900">Buyer Profile</div>
          <div className="mt-1 text-xs text-neutral-500">AI-derived preferences snapshot</div>
        </div>

        <ConfidenceMeter value={lead.profileConfidence ?? null} />
      </div>

      <div className="mt-4 space-y-4">
        {/* Must haves */}
        {(lead.mustHaves?.length ?? 0) > 0 ? (
          <section>
            <div className="text-xs font-medium text-neutral-700">Must-haves</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(lead.mustHaves ?? []).slice(0, 8).map((x) => (
                <Chip key={x} tone="positive">
                  {x}
                </Chip>
              ))}
            </div>
          </section>
        ) : null}

        {/* Dealbreakers */}
        {(lead.dealBreakers?.length ?? 0) > 0 ? (
          <section>
            <div className="text-xs font-medium text-neutral-700">Dealbreakers</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(lead.dealBreakers ?? []).slice(0, 6).map((x) => (
                <Chip key={x} tone="negative">
                  {x}
                </Chip>
              ))}
            </div>
          </section>
        ) : null}

        {/* Nice to have */}
        {(lead.niceToHaves?.length ?? 0) > 0 ? (
          <section>
            <div className="text-xs font-medium text-neutral-700">Nice-to-haves</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(lead.niceToHaves ?? []).slice(0, 8).map((x) => (
                <Chip key={x} tone="neutral">
                  {x}
                </Chip>
              ))}
            </div>
          </section>
        ) : null}

        <div className="rounded-lg bg-neutral-50 p-3">
          <div className="text-xs font-medium text-neutral-700">Structured snapshot</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="text-neutral-600">Kind</div>
            <div className="text-neutral-900">{lead.kind ?? "—"}</div>

            <div className="text-neutral-600">Property</div>
            <div className="text-neutral-900">{lead.propertyType ?? "—"}</div>

            <div className="text-neutral-600">Budget</div>
            <div className="text-neutral-900">
              {lead.budgetMin ?? "—"} – {lead.budgetMax ?? "—"}
            </div>

            <div className="text-neutral-600">Bedrooms</div>
            <div className="text-neutral-900">
              {lead.bedroomsMin ?? "—"} – {lead.bedroomsMax ?? "—"}
            </div>
          </div>

          <button className="mt-3 w-full rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50">
            Edit overrides
          </button>
        </div>
      </div>
    </div>
  );
}
