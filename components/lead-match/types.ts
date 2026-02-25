// components/lead-match/types.ts
export type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export type LeadSummary = {
  id: string;
  displayName?: string | null; // e.g. "John D." or "Lead #123"
  createdAt: string; // ISO
  source?: string | null; // "Website", "WhatsApp"
  status?: "NEW" | "NEEDS_REVIEW" | "CONTACTED" | "QUALIFIED" | "CLOSED";
  // BuyerProfile snapshot (structured)
  kind?: "RENT" | "SALE" | null;
  propertyType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  bedroomsMin?: number | null;
  bedroomsMax?: number | null;
  communes?: string[] | null;

  mustHaves?: string[]; // derived in UI if not stored
  niceToHaves?: string[];
  dealBreakers?: string[];

  // AI / meta
  profileConfidence?: number | null; // 0..1 if available
};


export type ScoreBreakdown = {
  overall?: number | null;
  structuredScore: number;
  semanticScore: number;
  freshnessScore?: number | null; // ✅ add
};


export type MatchReason = {
  label: string;
  tone: "positive" | "negative" | "neutral";
};

export type LeadMatchResult = {
  id: string; // LeadMatch id
  listingId: string;

  title: string;
  locationLine?: string | null; // "Kirchberg, Luxembourg"
  price?: number | null;
  bedrooms?: number | null;
  sizeSqm?: number | null;

  status?: "PUBLISHED" | "DRAFT" | "ARCHIVED";

  scores: ScoreBreakdown;

  // Derived from your debug/meta OR inferred from structured fields
  reasons?: MatchReason[];

  // Stored debug info (show only in Debug tab)
  usedWhereMode?: string | null;
  dynamicWeights?: Record<string, number> | null;
  meta?: unknown; // keep flexible
};

export type MatchSortKey = "BEST_OVERALL" | "BEST_VALUE" | "CLOSEST" | "NEWEST" | "HIGH_SEMANTIC";
