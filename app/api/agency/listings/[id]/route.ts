// app/api/agency/listings/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";

export const runtime = "nodejs";

type UpdateListingBody = {
  title?: string;
  price?: number;
};

function canEdit(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT";
}

function canDelete(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

async function getScopedListingOrNull(listingId: string, agencyId: string) {
  return prisma.listing.findFirst({
    where: { id: listingId, agencyId },
    select: { id: true, price: true },
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { membership, agency } = await requireAgencyContext();
  if (!canEdit(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const existing = await getScopedListingOrNull(id, agency.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as UpdateListingBody;

  const nextTitle =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim()
      : undefined;

  const nextPrice =
    typeof body.price === "number" && Number.isFinite(body.price)
      ? body.price
      : undefined;

  const updateData: { title?: string; price?: number } = {};
  if (nextTitle !== undefined) updateData.title = nextTitle;
  if (nextPrice !== undefined) updateData.price = nextPrice;

  const priceChanged = nextPrice !== undefined && nextPrice !== existing.price;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(updateData).length > 0) {
      await tx.listing.update({
        where: { id },
        data: updateData,
        select: { id: true },
      });
    }

    if (priceChanged) {
      await tx.listingPriceHistory.create({
        data: { listingId: id, price: nextPrice!, recordedAt: new Date() },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { membership, agency } = await requireAgencyContext();
  if (!canDelete(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const existing = await getScopedListingOrNull(id, agency.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.listingMedia.deleteMany({ where: { listingId: id } });
    await tx.listingPriceHistory.deleteMany({ where: { listingId: id } });
    await tx.listing.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
