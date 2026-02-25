// app/listing/[id]/page.tsx
import { notFound } from "next/navigation";
import { dealScore } from "@/lib/scoring";
import { getListingById } from "@/lib/repos/listingsRepo";
import type { Listing } from "@/lib/mockData";
import { LeadCaptureForm } from "@/app/components/LeadCaptureForm";

type ListingMediaRow = {
  url: string;
  sortOrder: number | null;
};

type AgencyRow = {
  name: string | null;
};

type ListingDbRow = {
  id: string;
  title: string;
  commune: string;
  addressHint: string | null;
  price: number;
  sizeSqm: number;
  bedrooms: number;
  bathrooms: number;
  condition: "TO_RENOVATE" | "NEW" | "RENOVATED" | "GOOD" | string;
  energyClass: string;
  createdAt: Date;
  media?: ListingMediaRow[] | null;
  agency?: AgencyRow | null;
};

const ENERGY_SET = new Set(["A", "B", "C", "D", "E", "F"] as const);
type EnergyClass = "A" | "B" | "C" | "D" | "E" | "F";

function toEnergyClass(v: unknown): EnergyClass {
  if (typeof v !== "string") return "D";
  const t = v.trim().toUpperCase();
  return ENERGY_SET.has(t as EnergyClass) ? (t as EnergyClass) : "D";
}

function mapDbToUi(row: ListingDbRow): Listing {
  return {
    id: row.id,
    title: row.title,
    commune: row.commune,
    addressHint: row.addressHint ?? undefined,
    price: row.price,
    sizeSqm: row.sizeSqm,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    condition:
      row.condition === "TO_RENOVATE"
        ? "To renovate"
        : row.condition === "NEW"
        ? "New"
        : row.condition === "RENOVATED"
        ? "Renovated"
        : "Good",
    // ✅ clamp string -> union
    energyClass: toEnergyClass(row.energyClass),
    images: (row.media ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((m) => m.url),
    agencyName: row.agency?.name ?? "Marketplace",
    createdAt: row.createdAt.toISOString(),
  };
}

function formatEUR(n: number) {
  return new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function ListingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // IMPORTANT: getListingById must include media relation (ListingMedia) in its query.
  const row = (await getListingById(id)) as ListingDbRow | null;
  if (!row) return notFound();

  const listing = mapDbToUi(row);
  const s = dealScore(listing);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{listing.title}</h1>

        <p className="text-muted-foreground">
          {listing.commune} • {listing.sizeSqm} m² • {listing.bedrooms} BR
        </p>

        <p className="text-sm text-muted-foreground">Listed by {listing.agencyName}</p>

        <p className="text-xl font-bold">{formatEUR(listing.price)}</p>
      </div>

      {/* Images */}
      {listing.images.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listing.images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${src}-${i}`}
              src={src}
              alt=""
              className="w-full h-64 object-cover rounded-md border"
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
        </section>
      )}

      {/* AI Summary */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">AI Summary</h2>
        <p className="text-muted-foreground">
          This property is rated <strong>{s.grade}</strong> with a score of {s.score}/100. It is priced{" "}
          {s.vsAvgPct !== null
            ? `${s.vsAvgPct > 0 ? "above" : "below"} commune average`
            : "close to market"}{" "}
          and offers an estimated gross yield of {s.estGrossYieldPct}%.
        </p>
      </section>

      {/* Investment Snapshot */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Price per sqm</p>
          <p className="font-semibold">{s.pricePerSqm.toLocaleString("de-LU")} €/m²</p>
        </div>

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Estimated Rent</p>
          <p className="font-semibold">{formatEUR(s.estMonthlyRent)} / month</p>
        </div>

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Gross Yield</p>
          <p className="font-semibold">{s.estGrossYieldPct}%</p>
        </div>
      </section>

      {/* Deal Explanation */}
      <section className="space-y-2">
        <h2 className="font-semibold text-lg">Deal Insights</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          {s.reasons.map((r, i) => (
            <li key={`${r}-${i}`}>{r}</li>
          ))}
        </ul>
      </section>

      <LeadCaptureForm listingId={listing.id} agencyName={listing.agencyName} />
    </main>
  );
}
