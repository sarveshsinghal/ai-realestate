// app/api/agency/listings/[id]/boost/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserContext } from "@/lib/requireUserContext";

export const runtime = "nodejs";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUserContext();
  const { id: listingId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const level = (body?.level ?? "BASIC") as "BASIC" | "PREMIUM" | "PLATINUM";
  const daysRaw = Number(body?.days ?? 14);
  const days = clamp(Number.isFinite(daysRaw) ? daysRaw : 14, 1, 60);

  const now = new Date();
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // ✅ Ensure listing exists
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true /*, agencyId: true, createdById: true, userId: true */ },
  });

  if (!listing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // TODO: enforce ownership based on your schema:
  // Example:
  // if (listing.agencyId !== userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const boost = await prisma.listingBoost.upsert({
    where: { listingId },
    update: {
      level,
      startsAt: now,
      endsAt,
    },
    create: {
      listingId,
      level,
      startsAt: now,
      endsAt,
    },
    select: { listingId: true, level: true, startsAt: true, endsAt: true },
  });

  return NextResponse.json({ ok: true, boost });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUserContext();
  const { id: listingId } = await ctx.params;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true /*, agencyId: true, createdById: true, userId: true */ },
  });

  if (!listing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // TODO: enforce ownership based on your schema (same as POST)

  await prisma.listingBoost.deleteMany({ where: { listingId } });
  return NextResponse.json({ ok: true });
}