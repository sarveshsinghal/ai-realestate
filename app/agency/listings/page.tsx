import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { dealScore } from "@/lib/scoring";
import { toScoringListing } from "@/lib/scoringAdapter";

function eur(n: number) {
  return `€${n.toLocaleString("de-LU")}`;
}

export default async function AgencyListingsPage() {
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
      _count: { select: { leads: true } },
    },
    take: 200,
  });

  const scored = listings.map((l) => {
    const s = dealScore(
      toScoringListing({
        id: l.id,
        title: l.title,
        commune: l.commune,
        price: l.price,
        sizeSqm: l.sizeSqm,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        condition: l.condition,
        energyClass: l.energyClass,
      })
    );

    return { l, s };
  });

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Listings</h1>
        <p className="text-muted-foreground">{agency.name}</p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/agency"
          className="inline-flex items-center px-3 py-2 rounded-md border text-sm"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3">Listing</th>
              <th className="p-3">Price</th>
              <th className="p-3">Score</th>
              <th className="p-3">Leads</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {scored.map(({ l, s }) => (
              <tr key={l.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{l.title}</div>
                  <div className="text-muted-foreground">
                    {l.commune} • {l.bedrooms}BR • {l.sizeSqm} sqm
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    <Link className="underline" href={`/listing/${l.id}`}>
                      View public
                    </Link>
                    {" · "}
                    <Link className="underline" href={`/agency/listings/${l.id}`}>
                      Manage
                    </Link>
                  </div>
                </td>

                <td className="p-3 whitespace-nowrap">{eur(l.price)}</td>

                <td className="p-3 whitespace-nowrap">
                  <div className="font-medium">{s.score}/100</div>
                  <div className="text-muted-foreground">Grade {s.grade}</div>
                </td>

                <td className="p-3 whitespace-nowrap">{l._count.leads}</td>

                <td className="p-3 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-1 rounded-md border">
                    {l.isPublished ? "PUBLISHED" : "DRAFT"}
                  </span>
                </td>

                <td className="p-3 text-right whitespace-nowrap">
                  <PublishToggleButton
                    listingId={l.id}
                    isPublished={l.isPublished}
                  />
                </td>
              </tr>
            ))}

            {scored.length === 0 && (
              <tr>
                <td className="p-6 text-muted-foreground" colSpan={6}>
                  No listings yet for this agency.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// server component -> render a client button
import PublishToggleButton from "./publish-toggle-button";
