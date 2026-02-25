// app/agency/listings/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ListingEditor from "@/app/agency/listings/_components/ListingEditor";
import { requireAgencyContext } from "@/lib/requireAgencyContext";

export const runtime = "nodejs";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { agency } = await requireAgencyContext();
  const { id: listingId } = await params;

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, agencyId: agency.id },
    select: {
      id: true,

      title: true,
      description: true,

      kind: true,
      propertyType: true,

      commune: true,
      addressHint: true,

      price: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,

      condition: true,
      energyClass: true,

      status: true,
      soldReason: true,
      soldAt: true,
      archivedAt: true,

      availableFrom: true,
      yearBuilt: true,
      floor: true,
      totalFloors: true,

      furnished: true,
      petsAllowed: true,

      hasElevator: true,
      hasBalcony: true,
      hasTerrace: true,
      hasGarden: true,
      hasCellar: true,
      parkingSpaces: true,

      heatingType: true,
      chargesMonthly: true,
      feesAgency: true,
      deposit: true,

      isPublished: true,

      media: {
        select: { url: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },

      priceHistory: {
        select: { price: true, recordedAt: true },
        orderBy: { recordedAt: "desc" },
        take: 50,
      },
    },
  });

  if (!listing) return notFound();

  return (
    <ListingEditor
      listing={{
        ...listing,
        availableFrom: listing.availableFrom ? listing.availableFrom.toISOString() : null,
        soldAt: listing.soldAt ? listing.soldAt.toISOString() : null,
        archivedAt: listing.archivedAt ? listing.archivedAt.toISOString() : null,
      }}
      initialMedia={listing.media}
      priceHistory={listing.priceHistory.map((p) => ({
        price: p.price,
        createdAt: p.recordedAt.toISOString(),
      }))}
    />
  );
}