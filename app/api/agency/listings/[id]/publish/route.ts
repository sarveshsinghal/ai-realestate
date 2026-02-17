// app/api/agency/listings/[id]/publish/route.ts (or wherever this file lives)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { MemberRole } from "@prisma/client";
import { indexListing } from "@/lib/search/indexListing"; // ✅ A4: reindex on publish toggle

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { membership, agency } = await requireAgencyContext();

    // Only ADMIN/MANAGER can publish/unpublish
    if (![MemberRole.ADMIN, MemberRole.MANAGER].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const isPublished = Boolean(body?.isPublished);

    // Ensure listing belongs to this agency
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true, agencyId: true, isPublished: true },
    });

    if (!listing || listing.agencyId !== agency.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // No-op if already same state
    if (listing.isPublished === isPublished) {
      return NextResponse.json({ id: listing.id, isPublished: listing.isPublished });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { isPublished },
      select: { id: true, isPublished: true },
    });

    // ✅ Reindex AFTER DB update succeeds
    // - If published => embed + store vector
    // - If unpublished => clear embedding (per indexListing logic)
    try {
      await indexListing(id);
    } catch (e) {
      console.error("indexListing failed after publish toggle:", e);
      // Best-effort; don't fail publish UX
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Publish toggle error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
