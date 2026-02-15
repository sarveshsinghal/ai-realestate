type ParsedQuery = {
  commune?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minSqm?: number;
  maxSqm?: number;
  intent?: "buy" | "rent";
};

function parseMoney(token: string): number | null {
  const t = token.toLowerCase().replace(/[,€]/g, "").trim();

  // 800k, 1.2m
  const m = t.match(/^(\d+(\.\d+)?)(k|m)$/);
  if (m) {
    const num = Number(m[1]);
    const mult = m[3] === "k" ? 1000 : 1000000;
    return Math.round(num * mult);
  }

  // 800000
  if (/^\d{4,9}$/.test(t)) return Number(t);

  return null;
}

export function parseSearchQuery(q: string, knownCommunes: string[]): ParsedQuery {
  const text = q.toLowerCase();

  const out: ParsedQuery = {};

  if (text.includes("rent")) out.intent = "rent";
  if (text.includes("buy") || text.includes("purchase")) out.intent = "buy";

  // bedrooms: "2 bedroom", "2br", "3 bed"
  const br =
    text.match(/(\d+)\s*(bedrooms?|beds?)/) ||
    text.match(/(\d+)\s*br\b/);
  if (br) out.bedrooms = Number(br[1]);

  // size: "80 sqm", "80m2"
  const sqm =
    text.match(/(\d+)\s*(sqm|m2|m²)/);
  if (sqm) out.minSqm = Number(sqm[1]);

  // price constraints: "under 800k", "below 900000", "max 1.2m"
  const under =
    text.match(/(under|below|max)\s*([€\d\.,]+(?:k|m)?)/);
  if (under) out.maxPrice = parseMoney(under[2]) ?? undefined;

  const over =
    text.match(/(over|above|min)\s*([€\d\.,]+(?:k|m)?)/);
  if (over) out.minPrice = parseMoney(over[2]) ?? undefined;

  // commune match (best-effort): find first commune keyword contained
  const commune = knownCommunes.find((c) => text.includes(c.toLowerCase()));
  if (commune) out.commune = commune;

  return out;
}
