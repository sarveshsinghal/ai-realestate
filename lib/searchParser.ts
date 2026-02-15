type ParsedQuery = {
  commune?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minSqm?: number;
  maxSqm?: number;
  intent?: "buy" | "rent";
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[’'"]/g, "").replace(/\s+/g, " ").trim();
}

function parseMoney(raw: string): number | null {
  const t = normalize(raw).replace(/€/g, "").replace(/,/g, "").trim();

  // 900k / 1.2m / 900 k
  const m = t.match(/^(\d+(\.\d+)?)(\s*)(k|m)$/);
  if (m) {
    const num = Number(m[1]);
    const mult = m[4] === "k" ? 1000 : 1000000;
    return Math.round(num * mult);
  }

  // 900000 / 900.000 / 900 000
  const digits = t.replace(/\./g, "").replace(/\s/g, "");
  if (/^\d{4,9}$/.test(digits)) return Number(digits);

  return null;
}

export function parseSearchQuery(
  q: string,
  knownCommunes: string[],
  aliasMap: Record<string, string> = {}
): ParsedQuery {
  const text = normalize(q);
  const out: ParsedQuery = {};

  if (text.includes("rent")) out.intent = "rent";
  if (text.includes("buy") || text.includes("purchase")) out.intent = "buy";

  // bedrooms: "2 bedroom", "2 bedrooms", "2 bed", "2br"
  const br =
    text.match(/(\d+)\s*(bedrooms?|beds?|bed)\b/) ||
    text.match(/(\d+)\s*br\b/);
  if (br) out.bedrooms = Number(br[1]);

  // size: "80 sqm", "80m2", "80 m²"
  const sqm = text.match(/(\d+)\s*(sqm|m2|m²)\b/);
  if (sqm) out.minSqm = Number(sqm[1]);

  // price constraints
  const under = text.match(/\b(under|below|max)\s*([€\d\.,\s]+(k|m)?)\b/);
  if (under) out.maxPrice = parseMoney(under[2]) ?? undefined;

  const over = text.match(/\b(over|above|min)\s*([€\d\.,\s]+(k|m)?)\b/);
  if (over) out.minPrice = parseMoney(over[2]) ?? undefined;

  // Commune matching with aliases
  // If user typed an alias, map it to a canonical commune name
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (text.includes(normalize(alias))) {
      out.commune = canonical;
      break;
    }
  }

  // If no alias matched, try direct commune match
  if (!out.commune) {
    const found = knownCommunes.find((c) => text.includes(normalize(c)));
    if (found) out.commune = found;
  }

  return out;
}
