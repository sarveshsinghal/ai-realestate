// components/lead-match/reasons.ts
export type ReasonsV1 = {
  version: 1;

  // chips shown in collapsed row (fast scan)
  highlights?: Array<{ label: string; tone: "positive" | "negative" | "neutral" }>;

  // richer detail view
  positives?: Array<{ label: string; detail?: string }>;
  negatives?: Array<{ label: string; detail?: string }>;
  neutrals?: Array<{ label: string; detail?: string }>;

  // optional: raw scoring details / weights you already store elsewhere
  meta?: Record<string, unknown>;
};
