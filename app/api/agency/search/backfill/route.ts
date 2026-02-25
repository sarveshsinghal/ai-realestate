// app/api/agency/search/backfill/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import { MemberRole } from "@prisma/client";
import { indexListing } from "@/lib/search/indexListing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { membership, agency } = await requireAgencyContext();

  // ✅ TS-safe role check (no logic change)
  const allowedRoles: MemberRole[] = [MemberRole.ADMIN, MemberRole.MANAGER];
  if (!allowedRoles.includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const limit =
    typeof body.limit === "number"
      ? Math.max(1, Math.min(500, Math.floor(body.limit)))
      : 200;

  const listings = await prisma.listing.findMany({
    where: { agencyId: agency.id },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  let ok = 0;
  let fail = 0;

  for (const l of listings) {
    try {
      await indexListing(l.id);
      ok++;
    } catch (e) {
      console.error("indexListing failed for", l.id, e);
      fail++;
    }
  }

  return NextResponse.json({ ok, fail, total: listings.length });
}
