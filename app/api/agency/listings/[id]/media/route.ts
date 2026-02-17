// app/api/agency/listings/[id]/media/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";

export const runtime = "nodejs";

type MediaItem = { url: string };
type PutMediaBody = { media: MediaItem[] };

function canEdit(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT";
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { membership, agency } = await requireAgencyContext();

  if (!canEdit(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const listing = await prisma.listing.findFirst({
    where: { id, agencyId: agency.id },
    select: { id: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as PutMediaBody;
  const media = Array.isArray(body.media) ? body.media : [];

  // Validate URLs (basic)
  const normalized = media
    .map((m) => (typeof m?.url === "string" ? m.url.trim() : ""))
    .filter((u) => u.length > 0);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniqueOrdered: string[] = [];
  for (const u of normalized) {
    if (!seen.has(u)) {
      seen.add(u);
      uniqueOrdered.push(u);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.listingMedia.deleteMany({ where: { listingId: id } });

    if (uniqueOrdered.length > 0) {
      await tx.listingMedia.createMany({
        data: uniqueOrdered.map((url, idx) => ({
          listingId: id,
          url,
          sortOrder: idx,
        })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
