// app/api/listings/[id]/status/route.ts
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { NextResponse } from "next/server";

type ListingStatus = "ACTIVE" | "SOLD" | "UNAVAILABLE" | "ARCHIVED";
const ALLOWED: ListingStatus[] = ["ACTIVE", "SOLD", "UNAVAILABLE", "ARCHIVED"];

function isListingStatus(v: unknown): v is ListingStatus {
  return typeof v === "string" && (ALLOWED as string[]).includes(v);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { agency } = await requireAgencyContext();
  const { id } = await ctx.params;

  const formData = await req.formData();
  const statusRaw = formData.get("status");
  const soldReasonRaw = formData.get("soldReason");

  if (!isListingStatus(statusRaw)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const soldReason =
    typeof soldReasonRaw === "string" && soldReasonRaw.trim()
      ? soldReasonRaw.trim()
      : null;

  // Load listing and verify access
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      agencyId: true,
      isPublished: true,
      soldAt: true,
      archivedAt: true,
      status: true,
    },
  });

  if (!listing || listing.agencyId !== agency.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  // Build update payload deterministically
  const listingUpdate: {
    status: ListingStatus;
    soldAt?: Date | null;
    archivedAt?: Date | null;
    soldReason?: string | null;
  } = { status: statusRaw };

  if (statusRaw === "SOLD" || statusRaw === "UNAVAILABLE") {
    // keep soldAt as first time sold (don’t overwrite)
    listingUpdate.soldAt = listing.soldAt ?? now;
    // sold/unavailable should not be archived automatically immediately
    listingUpdate.archivedAt = null;
    // store reason if provided
    listingUpdate.soldReason = soldReason;
  } else if (statusRaw === "ARCHIVED") {
    // archived should have archivedAt
    listingUpdate.archivedAt = listing.archivedAt ?? now;
    // keep soldAt untouched
    // optional: keep soldReason as-is
  } else if (statusRaw === "ACTIVE") {
    // re-activate: clear archive marker
    listingUpdate.archivedAt = null;
    // optional: we keep soldAt/soldReason unless you want to clear them.
    // listingUpdate.soldAt = null;
    // listingUpdate.soldReason = null;
  }

  // Keep search index consistent:
  // Only mark search index as PUBLISHED when listing is ACTIVE *and* published.
  const searchIndexStatus =
    statusRaw === "ACTIVE" && listing.isPublished ? "PUBLISHED" : "UNPUBLISHED";

  await prisma.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id },
      data: listingUpdate,
    });

    // If you have a searchIndex row, update it. If not, ignore.
    await tx.listingSearchIndex.updateMany({
      where: { listingId: id },
      data: { status: searchIndexStatus },
    });
  });

  return NextResponse.redirect(new URL(`/agency/listings/${id}`, req.url));
}