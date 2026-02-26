import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserContext } from "@/lib/requireUserContext";

const PostSchema = z.object({
  listingId: z.string().min(1),
});

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

function getLimit(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("limit");
  const n = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireUserContext();

    const cursor = req.nextUrl.searchParams.get("cursor"); // cursor = wishlistItem.id
    const limit = getLimit(req);

    const rows = await prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            commune: true,
            kind: true,
            propertyType: true,
            status: true,
            isPublished: true,
            media: {
              take: 1,
              orderBy: { sortOrder: "asc" },
              select: { url: true },
            },
            popularity: { select: { badge: true } },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        listing: {
          ...r.listing,
          thumbnailUrl: r.listing.media?.[0]?.url ?? null,
          popularityBadge: r.listing.popularity?.badge ?? "NONE",
        },
      })),
      nextCursor,
    });
  } catch (err: any) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireUserContext();
    const body = PostSchema.parse(await req.json());

    const listing = await prisma.listing.findUnique({
      where: { id: body.listingId },
      select: { id: true, status: true, isPublished: true },
    });
    if (!listing) return NextResponse.json({ error: "LISTING_NOT_FOUND" }, { status: 404 });

    // Allow saving any listing (even unpublished/non-active) if you want.
    // If you want to restrict to ACTIVE only, uncomment:
    // if (listing.status !== "ACTIVE") return NextResponse.json({ error: "NOT_SAVEABLE" }, { status: 400 });

    await prisma.wishlistItem.upsert({
      where: { userId_listingId: { userId, listingId: body.listingId } },
      update: {},
      create: { userId, listingId: body.listingId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof NextResponse) return err;
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "INVALID_BODY", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}