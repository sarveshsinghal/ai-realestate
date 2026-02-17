export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { MemberRole } from "@prisma/client";

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
      select: { id: true, agencyId: true },
    });

    if (!listing || listing.agencyId !== agency.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { isPublished },
      select: { id: true, isPublished: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Publish toggle error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
