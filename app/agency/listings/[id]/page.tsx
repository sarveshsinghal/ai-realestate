import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { notFound } from "next/navigation";

export default async function AgencyListingManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { agency } = await requireAgencyContext();
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      commune: true,
      price: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,
      isPublished: true,
      agencyId: true,
      createdAt: true,
    },
  });

  if (!listing || listing.agencyId !== agency.id) notFound();

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Manage listing</h1>
        <p className="text-muted-foreground">{listing.title}</p>
      </div>

      <div className="border rounded-md p-4 space-y-2">
        <div className="text-sm text-muted-foreground">Details</div>
        <div>
          <div className="font-medium">{listing.commune}</div>
          <div className="text-muted-foreground">
            €{listing.price.toLocaleString("de-LU")} • {listing.bedrooms}BR •{" "}
            {listing.sizeSqm} sqm
          </div>
        </div>

        <div className="pt-2 text-sm text-muted-foreground">
          Status: {listing.isPublished ? "Published" : "Draft"}
        </div>
      </div>

      <div className="flex gap-3">
        <Link className="underline" href="/agency/listings">
          Back to listings
        </Link>
        <Link className="underline" href={`/listing/${listing.id}`}>
          View public
        </Link>
      </div>

      <div className="text-sm text-muted-foreground">
        Next: edit form, media management, pricing history, and AI recommendations.
      </div>
    </main>
  );
}
