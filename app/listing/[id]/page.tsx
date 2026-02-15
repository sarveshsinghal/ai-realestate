import { notFound } from "next/navigation";
import { LISTINGS } from "@/lib/mockData";
import { dealScore } from "@/lib/scoring";

function formatEUR(n: number) {
  return new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ListingDetail({
  params,
}: {
  params: { id: string };
}) {
  const listing = LISTINGS.find((l) => l.id === params.id);
  if (!listing) return notFound();

  const s = dealScore(listing);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{listing.title}</h1>
        <p className="text-muted-foreground">
          {listing.commune} • {listing.sizeSqm} m² • {listing.bedrooms} BR
        </p>
        <p className="text-xl font-bold">{formatEUR(listing.price)}</p>
      </div>

      {/* AI Summary */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">AI Summary</h2>
        <p className="text-muted-foreground">
          This property is rated <strong>{s.grade}</strong> with a score of{" "}
          {s.score}/100. It is priced{" "}
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
          <p className="font-semibold">
            {s.pricePerSqm.toLocaleString("de-LU")} €/m²
          </p>
        </div>

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Estimated Rent</p>
          <p className="font-semibold">
            {formatEUR(s.estMonthlyRent)} / month
          </p>
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
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

    </main>
  );
}
