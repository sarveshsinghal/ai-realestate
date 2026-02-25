// components/lead-match/mappers.ts
import type { LeadMatchResult, MatchReason } from "./types";
import type { ReasonsV1 } from "./reasons";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function normalizeReasonsToChips(reasons: unknown): MatchReason[] {
  if (!reasons) return [];

  const r = reasons as Partial<ReasonsV1>;

  if (Array.isArray(r.highlights)) {
    return r.highlights
      .filter((x) => x && typeof x.label === "string" && x.label.length > 0)
      .slice(0, 12)
      .map((x) => ({
        label: x.label as string,
        tone: (x.tone ?? "neutral") as MatchReason["tone"],
      }));
  }

  const chips: MatchReason[] = [];

  if (Array.isArray(r.positives)) {
    chips.push(
      ...r.positives
        .filter((x) => x && typeof x.label === "string")
        .map((x) => ({ label: x.label as string, tone: "positive" as const }))
    );
  }

  if (Array.isArray(r.negatives)) {
    chips.push(
      ...r.negatives
        .filter((x) => x && typeof x.label === "string")
        .map((x) => ({ label: x.label as string, tone: "negative" as const }))
    );
  }

  if (Array.isArray(r.neutrals)) {
    chips.push(
      ...r.neutrals
        .filter((x) => x && typeof x.label === "string")
        .map((x) => ({ label: x.label as string, tone: "neutral" as const }))
    );
  }

  if (chips.length) return chips.slice(0, 12);

  if (Array.isArray(reasons) && reasons.every((x) => typeof x === "string")) {
    return (reasons as string[]).slice(0, 10).map((label) => ({ label, tone: "neutral" as const }));
  }

  if (typeof reasons === "object") {
    try {
      return Object.keys(reasons as Record<string, unknown>)
        .slice(0, 10)
        .map((k) => ({ label: k, tone: "neutral" as const }));
    } catch {
      return [];
    }
  }

  return [];
}

export function fromDbLeadMatchToUI(db: {
  id: string;
  listingId: string;
  scope: string;

  score: number;
  structuredScore: number;
  semanticScore: number;
  freshnessScore: number | null;

  reasons: unknown;
  createdAt: Date;

  listing: {
    id: string;
    title: string | null;
    commune: string | null;
    price: number | null;
    bedrooms: number | null;
    sizeSqm: number | null;
    status: "PUBLISHED" | "DRAFT" | "ARCHIVED" | null;
  };
}): LeadMatchResult {
  const title = db.listing.title ?? "Untitled listing";
  const locationLine = db.listing.commune ? `${db.listing.commune}, Luxembourg` : "Luxembourg";

  return {
    id: db.id,
    listingId: db.listingId,

    title,
    locationLine,

    price: db.listing.price ?? null,
    bedrooms: db.listing.bedrooms ?? null,
    sizeSqm: db.listing.sizeSqm ?? null,

    // ✅ undefined instead of null
    status: db.listing.status ?? undefined,

    scores: {
      overall: clamp01(db.score),
      structuredScore: clamp01(db.structuredScore),
      semanticScore: clamp01(db.semanticScore),
      freshnessScore: db.freshnessScore == null ? null : clamp01(db.freshnessScore),
    },

    reasons: normalizeReasonsToChips(db.reasons),

    usedWhereMode: db.scope,
    dynamicWeights: null,
    meta: {
      reasons: db.reasons,
      createdAt: db.createdAt.toISOString(),
      scope: db.scope,
    },
  };
}
