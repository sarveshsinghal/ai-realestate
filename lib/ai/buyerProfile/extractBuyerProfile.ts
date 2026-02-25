// lib/ai/buyerProfile/extractBuyerProfile.ts
import OpenAI from "openai";
import { ListingKind, PropertyType } from "@prisma/client";

export type ExtractedBuyerProfile = {
  kind: ListingKind | null;
  propertyType: PropertyType | null;

  budgetMin: number | null;
  budgetMax: number | null;
  sizeMinSqm: number | null;
  sizeMaxSqm: number | null;

  bedroomsMin: number | null;
  bedroomsMax: number | null;
  bathroomsMin: number | null;

  communes: string[];

  furnished: boolean | null;
  petsAllowed: boolean | null;
  hasElevator: boolean | null;
  hasBalcony: boolean | null;
  hasTerrace: boolean | null;
  hasGarden: boolean | null;
  hasCellar: boolean | null;
  parkingMin: number | null;

  queryText: string | null; // a compact natural-language summary for embedding
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clampInt(n: unknown, min: number, max: number): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const v = Math.floor(n);
  return Math.max(min, Math.min(max, v));
}

function toBoolOrNull(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function toStringArray(v: unknown, maxLen = 20): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string") {
      const s = x.trim();
      if (s) out.push(s.slice(0, 80));
    }
    if (out.length >= maxLen) break;
  }
  return Array.from(new Set(out));
}

function toEnumOrNull<T extends Record<string, string>>(enumObj: T, v: unknown): T[keyof T] | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return (Object.values(enumObj) as string[]).includes(c) ? (c as T[keyof T]) : null;
}

export async function extractBuyerProfile(params: {
  leadMessage: string;
  listingContext?: {
    title?: string | null;
    commune?: string | null;
    price?: number | null;
    kind?: ListingKind | null;
    propertyType?: PropertyType | null;
  };
}): Promise<ExtractedBuyerProfile> {
  const { leadMessage, listingContext } = params;

  const system = `
You extract buyer intent/preferences for Luxembourg real estate.
Return ONLY valid JSON matching the schema. No markdown.

Rules:
- If unknown, use null (not empty string).
- communes: array of commune names (Luxembourg). If none, [].
- budgetMin/budgetMax in EUR as integers if present.
- sizes in sqm as integers if present.
- bedrooms/bathrooms as integers if present.
- parkingMin integer if present.
- Infer kind SALE vs RENT only if message strongly indicates. Otherwise null.
- propertyType only if explicit or strongly implied; else null.
- queryText: a short single-sentence summary of intent for embedding (English is fine).
`;

  const schemaExample = {
    kind: "SALE",
    propertyType: "APARTMENT",
    budgetMin: 0,
    budgetMax: 900000,
    sizeMinSqm: 70,
    sizeMaxSqm: null,
    bedroomsMin: 2,
    bedroomsMax: null,
    bathroomsMin: 1,
    communes: ["Strassen", "Bertrange"],
    furnished: null,
    petsAllowed: null,
    hasElevator: null,
    hasBalcony: true,
    hasTerrace: null,
    hasGarden: null,
    hasCellar: null,
    parkingMin: 1,
    queryText: "Looking to buy a 2-bedroom apartment in Strassen or Bertrange under €900k with balcony and parking."
  };

  const user = {
    listingContext: listingContext ?? null,
    leadMessage,
    outputSchemaExample: schemaExample
  };

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: system.trim() },
      { role: "user", content: JSON.stringify(user) }
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const result: ExtractedBuyerProfile = {
    kind: toEnumOrNull(ListingKind as any, parsed.kind) as any,
    propertyType: toEnumOrNull(PropertyType as any, parsed.propertyType) as any,

    budgetMin: clampInt(parsed.budgetMin, 0, 50_000_000),
    budgetMax: clampInt(parsed.budgetMax, 0, 50_000_000),

    sizeMinSqm: clampInt(parsed.sizeMinSqm, 0, 100_000),
    sizeMaxSqm: clampInt(parsed.sizeMaxSqm, 0, 100_000),

    bedroomsMin: clampInt(parsed.bedroomsMin, 0, 100),
    bedroomsMax: clampInt(parsed.bedroomsMax, 0, 100),
    bathroomsMin: clampInt(parsed.bathroomsMin, 0, 100),

    communes: toStringArray(parsed.communes),

    furnished: toBoolOrNull(parsed.furnished),
    petsAllowed: toBoolOrNull(parsed.petsAllowed),
    hasElevator: toBoolOrNull(parsed.hasElevator),
    hasBalcony: toBoolOrNull(parsed.hasBalcony),
    hasTerrace: toBoolOrNull(parsed.hasTerrace),
    hasGarden: toBoolOrNull(parsed.hasGarden),
    hasCellar: toBoolOrNull(parsed.hasCellar),
    parkingMin: clampInt(parsed.parkingMin, 0, 100),

    queryText: typeof parsed.queryText === "string" && parsed.queryText.trim()
      ? parsed.queryText.trim().slice(0, 500)
      : null,
  };

  return result;
}
