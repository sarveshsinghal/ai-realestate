// app/agency/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { dealScore } from "@/lib/scoring";
import { toScoringListing } from "@/lib/scoringAdapter";

export default async function AgencyDashboard() {
  const { agency } = await requireAgencyContext();

  const listings = await prisma.listing.findMany({
    where: { agencyId: agency.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      commune: true,
      price: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,
      condition: true,
      energyClass: true,
      isPublished: true,
      createdAt: true,
    },
    take: 50,
  });

  const [leadsCount, publishedCount] = await Promise.all([
    prisma.lead.count({ where: { agencyId: agency.id } }),
    prisma.listing.count({ where: { agencyId: agency.id, isPublished: true } }),
  ]);

  const scored = listings.map((l) => {
    const scoringListing = toScoringListing({
      id: l.id,
      title: l.title,
      commune: l.commune,
      price: l.price,
      sizeSqm: l.sizeSqm,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      condition: l.condition,
      energyClass: l.energyClass,
    });

    return { listing: l, s: dealScore(scoringListing) };
  });

  const totalListings = listings.length;
  const avgScore =
    totalListings === 0
      ? 0
      : Math.round(
          scored.reduce((acc, x) => acc + x.s.score, 0) / totalListings
        );

  const strongDealsA = scored.filter((x) => x.s.grade === "A").length;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Agency Intelligence Dashboard</h1>
        <p className="text-muted-foreground">{agency.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Total Listings</p>
          <p className="text-xl font-semibold">{totalListings}</p>
        </div>

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Published</p>
          <p className="text-xl font-semibold">{publishedCount}</p>
        </div>

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Avg Deal Score</p>
          <p className="text-xl font-semibold">{avgScore}/100</p>
        </div>

        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Strong Deals (A)</p>
          <p className="text-xl font-semibold">{strongDealsA}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/agency/listings"
          className="inline-flex items-center px-3 py-2 rounded-md border text-sm"
        >
          View listings
        </Link>
        <Link
          href="/agency/leads"
          className="inline-flex items-center px-3 py-2 rounded-md border text-sm"
        >
          View leads ({leadsCount})
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="font-semibold">Your Listings</h2>
          <Link href="/agency/listings" className="text-sm underline">
            Manage
          </Link>
        </div>

        <div className="border rounded-md divide-y">
          {scored.map(({ listing: l, s }) => (
            <div key={l.id} className="p-4 flex justify-between gap-4">
              <div>
                <p className="font-medium">{l.title}</p>
                <p className="text-sm text-muted-foreground">
                  {l.commune} {l.isPublished ? "• Published" : "• Draft"}
                </p>
                <div className="text-sm text-muted-foreground mt-1">
                  <Link className="underline" href={`/listing/${l.id}`}>
                    View public
                  </Link>
                  {" · "}
                  <Link className="underline" href={`/agency/listings/${l.id}`}>
                    Manage
                  </Link>
                </div>
              </div>

              <div className="text-right whitespace-nowrap">
                <p>Score: {s.score}/100</p>
                <p className="text-sm text-muted-foreground">Grade {s.grade}</p>
              </div>
            </div>
          ))}

          {scored.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              No listings yet for this agency.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
