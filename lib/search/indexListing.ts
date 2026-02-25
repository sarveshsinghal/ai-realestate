// lib/search/indexListing.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildListingSearchText } from "./buildListingSearchText";
import { embedText } from "./embeddings";

function normalizeEmbedding(input: unknown): number[] | null {
  // Accept: number[] OR string[] OR string blob like '{ "0.1","0.2" }' OR '[0.1,0.2]'
  let raw: unknown[] | null = null;

  if (Array.isArray(input)) {
    raw = input;
  } else if (typeof input === "string") {
    const s = input.trim();
    const matches = s.match(/-?\d+(\.\d+)?([eE]-?\d+)?/g);
    if (!matches) return null;
    raw = matches;
  } else if (input && typeof input === "object") {
    // In case someone passes { vector: ... } or { embedding: ... }
    const anyObj = input as any;
    if (Array.isArray(anyObj.vector)) raw = anyObj.vector;
    else if (Array.isArray(anyObj.embedding)) raw = anyObj.embedding;
    else if (Array.isArray(anyObj.data?.[0]?.embedding)) raw = anyObj.data[0].embedding;
    else if (Array.isArray(anyObj.data?.[0]?.vector)) raw = anyObj.data[0].vector;
  }

  if (!raw) return null;

  const nums = raw
    .map((x) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN))
    .filter((n) => Number.isFinite(n)) as number[];

  // Must be exactly 1536 dims for your schema vector(1536)
  if (nums.length !== 1536) return null;

  // Sanity: embeddings should not contain huge outliers. This catches garbage like "2235".
  if (nums.some((v) => Math.abs(v) > 5)) return null;

  return nums;
}

function toPgVectorLiteral(vec: number[]) {
  // pgvector accepts '[1,2,3]'::vector
  return `[${vec.map((v) => (Number.isFinite(v) ? String(v) : "0")).join(",")}]`;
}

export async function indexListing(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      agencyId: true,
      agencyName: true,
      isPublished: true,

      title: true,
      description: true,
      commune: true,
      addressHint: true,

      kind: true,
      propertyType: true,

      price: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,

      condition: true,
      energyClass: true,

      // amenities
      furnished: true,
      petsAllowed: true,
      hasElevator: true,
      hasBalcony: true,
      hasTerrace: true,
      hasGarden: true,
      hasCellar: true,
      parkingSpaces: true,

      // rent/infra fields
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
    await prisma.$executeRaw(
      Prisma.sql`
        update "ListingSearchIndex"
        set embedding = null
        where "listingId" = ${listingId};
      `
    );
    return;
  }

  // Published: best-effort embedding write
  try {
    const emb = await embedText(searchText);

    // Robust normalization (fixes the "{ "0.1","0.2" }" / quoted CSV issue and catches garbage dims)
    const vec = normalizeEmbedding((emb as any)?.vector ?? emb);

    if (!vec) {
      throw new Error(
        `Invalid embedding payload (expected 1536 finite floats). Got: ${
          Array.isArray((emb as any)?.vector)
            ? `array(len=${(emb as any).vector.length})`
            : typeof emb
        }`
      );
    }

    const literal = toPgVectorLiteral(vec);

    await prisma.$executeRaw(
      Prisma.sql`
        update "ListingSearchIndex"
        set embedding = ${literal}::vector(1536)
        where "listingId" = ${listingId};
      `
    );
  } catch (e) {
    console.error("embedText failed; leaving embedding null", e);
    // Keep best-effort behavior; optionally ensure it's null:
    // await prisma.$executeRaw(Prisma.sql`
    //   update "ListingSearchIndex" set embedding = null where "listingId" = ${listingId};
    // `);
  }
}
