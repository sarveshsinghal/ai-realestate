import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

function getOrCreateBuyerId() {
  const jar = cookies();
  const existing = jar.get("estateiq_buyer_id")?.value;
  if (existing && existing.trim()) return existing;

  const id = `anon_${randomUUID()}`;
  // 180 days
  jar.set("estateiq_buyer_id", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return id;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const listingId = formData.get("listingId");

  if (typeof listingId !== "string" || !listingId.trim()) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  const buyerId = getOrCreateBuyerId();

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      isPublished: true,
      commune: true,
      price: true,
      bedrooms: true,
      propertyType: true,
      kind: true,
      status: true,
    },
  });

  if (!listing || !listing.isPublished) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Build a sensible follow rule from the listing
  // - Commune exact (MVP)
  // - Price band +/- 15% (only if price exists)
  // - Same propertyType/kind
  // - Bedrooms within -1..+1 (MVP: store as min bedrooms)
  const minPrice = typeof listing.price === "number" ? Math.floor(listing.price * 0.85) : null;
  const maxPrice = typeof listing.price === "number" ? Math.ceil(listing.price * 1.15) : null;

  const communeCodes = listing.commune ? [listing.commune] : [];
  const bedroomsMin =
    typeof listing.bedrooms === "number" && listing.bedrooms > 0
      ? Math.max(0, listing.bedrooms - 1)
      : null;

  // Upsert-ish behavior (Prisma schema has no unique constraint here).
  // We'll deactivate older similar rules for same buyer/source and create a new active one.
  await prisma.$transaction(async (tx) => {
    await tx.similarFollowRule.updateMany({
      where: { buyerId, source: "sold_listing", isActive: true },
      data: { isActive: false },
    });

    await tx.similarFollowRule.create({
      data: {
        id: undefined as any, // Prisma will fill via @default(cuid()) if you changed it; otherwise remove this line
        buyerId,
        source: "sold_listing",
        communeCodes,
        minPrice,
        maxPrice,
        propertyType: listing.propertyType ?? null,
        bedrooms: bedroomsMin,
        isActive: true,
        // createdAt default in DB/schema
      } as any,
    });
  });

  // Redirect back to listing page with a success hint
  return NextResponse.redirect(new URL(`/listing/${listingId}?follow=1`, req.url));
}