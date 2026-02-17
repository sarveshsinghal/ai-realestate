// lib/search/indexListing.ts
import { prisma } from "@/lib/prisma";
import { buildListingSearchText } from "./buildListingSearchText";
import { embedText } from "./embeddings";

export async function indexListing(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      agencyId: true,
      agencyName: true,
      isPublished: true,

      title: true,
      description: true, // ✅ NEW
      commune: true,
      addressHint: true,

      kind: true, // ✅ NEW
      propertyType: true, // ✅ NEW

      price: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,

      condition: true,
      energyClass: true,

      // ✅ NEW amenities (optional but great for search)
      furnished: true,
      petsAllowed: true,
      hasElevator: true,
      hasBalcony: true,
      hasTerrace: true,
      hasGarden: true,
      hasCellar: true,
      parkingSpaces: true,

      // ✅ NEW: rent/infra fields (optional for search)
      heatingType: true,
      chargesMonthly: true,
      deposit: true,
      feesAgency: true,
      yearBuilt: true,
      floor: true,
      totalFloors: true,
      availableFrom: true,
    },
  });

  if (!listing) return;

  // agencyId is nullable in Listing; ListingSearchIndex requires it.
  if (!listing.agencyId) {
    console.warn("indexListing: listing has null agencyId; skipping", listingId);
    return;
  }

  const searchText = buildListingSearchText({
    id: listing.id,
    title: listing.title,
    commune: listing.commune,
    addressHint: listing.addressHint ?? null,
    description: listing.description ?? null,

    kind: String(listing.kind),
    propertyType: String(listing.propertyType),

    price: listing.price ?? null,
    sizeSqm: listing.sizeSqm ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,

    condition: String(listing.condition),
    energyClass: String(listing.energyClass),

    agencyName: listing.agencyName ?? null,

    // amenities
    furnished: listing.furnished ?? false,
    petsAllowed: listing.petsAllowed ?? false,
    hasElevator: listing.hasElevator ?? false,
    hasBalcony: listing.hasBalcony ?? false,
    hasTerrace: listing.hasTerrace ?? false,
    hasGarden: listing.hasGarden ?? false,
    hasCellar: listing.hasCellar ?? false,
    parkingSpaces: listing.parkingSpaces ?? 0,

    heatingType: listing.heatingType ? String(listing.heatingType) : null,
    chargesMonthly: listing.chargesMonthly ?? null,
    deposit: listing.deposit ?? null,
    feesAgency: listing.feesAgency ?? null,
    yearBuilt: listing.yearBuilt ?? null,
    floor: listing.floor ?? null,
    totalFloors: listing.totalFloors ?? null,
    availableFrom: listing.availableFrom ?? null,
  });

  const status = listing.isPublished ? "PUBLISHED" : "DRAFT";

  await prisma.listingSearchIndex.upsert({
    where: { listingId },
    create: {
      listingId,
      agencyId: listing.agencyId,
      status,
      searchText,

      // denormalized filters
      price: listing.price ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      sizeSqm: listing.sizeSqm ?? null,
      kind: String(listing.kind),
      propertyType: String(listing.propertyType),
      commune: listing.commune ?? null,
    },
    update: {
      agencyId: listing.agencyId,
      status,
      searchText,

      price: listing.price ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      sizeSqm: listing.sizeSqm ?? null,
      kind: String(listing.kind),
      propertyType: String(listing.propertyType),
      commune: listing.commune ?? null,
    },
  });

  // Drafts: keep embedding null
  if (!listing.isPublished) {
    await prisma.$executeRaw`
      update "ListingSearchIndex"
      set embedding = null
      where "listingId" = ${listingId};
    `;
    return;
  }

  // Published: best-effort embedding write
  try {
    const emb = await embedText(searchText);
    if (emb.vector.length !== 1536) {
      throw new Error(`Expected 1536 dims, got ${emb.vector.length}`);
    }

    await prisma.$executeRaw`
      update "ListingSearchIndex"
      set embedding = ${emb.vector}::vector(1536)
      where "listingId" = ${listingId};
    `;
  } catch (e) {
    console.error("embedText failed; leaving embedding null", e);
  }
}
