// app/api/agency/listings/[id]/publish/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import { MemberRole, ListingStatus } from "@prisma/client";
import { buildListingSearchText } from "@/lib/search/buildListingSearchText";
import { indexListing } from "@/lib/search/indexListing";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { membership, agency } = await requireAgencyContext();
    const allowedRoles: MemberRole[] = [MemberRole.ADMIN, MemberRole.MANAGER];

    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const isPublished = Boolean(body?.isPublished);

    // Must belong to agency
    const listing = await prisma.listing.findFirst({
      where: { id, agencyId: agency.id },
      select: {
        id: true,
        agencyId: true,
        agencyName: true,
        isPublished: true,

        // ✅ lifecycle
        status: true,

        title: true,
        description: true,
        commune: true,
        addressHint: true,
        price: true,
        sizeSqm: true,
        bedrooms: true,
        bathrooms: true,
        condition: true,
        energyClass: true,
        kind: true,
        propertyType: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 1) Update publish state
    const updated = await prisma.listing.update({
      where: { id },
      data: { isPublished },
      select: { id: true, isPublished: true },
    });

    // ✅ 2) Compute search index status (lifecycle-aware)
    // Only index as PUBLISHED when it's publicly visible and ACTIVE.
    const isIndexPublished =
      isPublished === true && listing.status === ListingStatus.ACTIVE;

    // Your hybrid SQL checks: si.status = 'PUBLISHED'
    // So anything else should NOT be 'PUBLISHED'
    const indexStatus = isIndexPublished ? "PUBLISHED" : "UNPUBLISHED";

    const searchText = buildListingSearchText({
      id: listing.id,
      title: listing.title,
      commune: listing.commune,
      addressHint: listing.addressHint ?? null,
      price: listing.price ?? null,
      sizeSqm: listing.sizeSqm ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      condition: String(listing.condition),
      energyClass: String(listing.energyClass),
      agencyName: listing.agencyName ?? null,
    });

    await prisma.listingSearchIndex.upsert({
      where: { listingId: id },
      create: {
        listingId: id,
        agencyId: agency.id,
        status: indexStatus,
        searchText,
        price: listing.price ?? null,
        bedrooms: listing.bedrooms ?? null,
        bathrooms: listing.bathrooms ?? null,
        sizeSqm: listing.sizeSqm ?? null,
        kind: String(listing.kind),
        propertyType: String(listing.propertyType),
        commune: listing.commune ?? null,
      },
      update: {
        agencyId: agency.id,
        status: indexStatus,
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

    // ✅ 3) Only embed/index when it will actually show up in public search
    if (isIndexPublished) {
      try {
        await indexListing(id);
      } catch (e) {
        console.error("indexListing failed after publish toggle", e);
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Publish toggle error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}