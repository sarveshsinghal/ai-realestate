import { LISTINGS } from "@/lib/mockData";
import { ListingCard } from "@/app/components/ListingCard";
import { Separator } from "@/components/ui/separator";
import { parseSearchQuery } from "@/lib/searchParser";
import { dealScore } from "@/lib/scoring";

const aliasMap: Record<string, string> = {
  "luxembourg city": "Luxembourg (Ville)",
  "lux city": "Luxembourg (Ville)",
  "ville": "Luxembourg (Ville)",
  "cloche dor": "Gasperich",
  "cloche d’or": "Gasperich",
  "cloche d'or": "Gasperich",
};


export default function ListingsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();

  const knownCommunes = Array.from(new Set(LISTINGS.map((l) => l.commune)));
  const parsed = q ? parseSearchQuery(q, knownCommunes, aliasMap) : {};

  const filtered = LISTINGS.filter((l) => {
    if (parsed.commune && l.commune !== parsed.commune) return false;
    if (parsed.bedrooms != null && l.bedrooms < parsed.bedrooms) return false;
    if (parsed.minPrice != null && l.price < parsed.minPrice) return false;
    if (parsed.maxPrice != null && l.price > parsed.maxPrice) return false;
    if (parsed.minSqm != null && l.sizeSqm < parsed.minSqm) return false;
    return true;
  }).sort((a, b) => dealScore(b).score - dealScore(a).score);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Listings in Luxembourg</h1>
          <p className="text-muted-foreground">
            AI-enhanced marketplace view (deal score, yield estimate, €/m²).
          </p>

          {q && (
            <p className="text-sm text-muted-foreground">
              Showing results for: <span className="font-medium">{q}</span> —{" "}
              {filtered.length} found
            </p>
          )}
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 text-muted-foreground">
            No matches. Try a different query like{" "}
            <span className="font-medium">"2 bedroom Gare under 600k"</span>.
          </div>
        )}
      </div>
    </main>
  );
}
