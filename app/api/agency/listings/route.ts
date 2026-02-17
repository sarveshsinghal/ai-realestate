// app/api/agency/listings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import { EnergyClass, ListingCondition } from "@prisma/client";
import { indexListing } from "@/lib/search/indexListing"; // ✅ A4: add this import

export const runtime = "nodejs";

type CreateListingBody = {
  title?: string;
  price?: number;
  commune?: string;
  sizeSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  condition?: string; // accept string input; map to Prisma enum safely
  energyClass?: string; // accept string input; map to Prisma enum safely
};

function canCreate(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT";
}

function safeString(v: unknown, fallback: string, maxLen: number): string {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  if (s.length === 0) return fallback;
  return s.slice(0, maxLen);
}

function safeInt(v: unknown, fallback: number, min: number): number {
  if (typeof v !== "number") return fallback;
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.floor(v));
}

function isEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value: string
): value is T[keyof T] {
  return (Object.values(enumObj) as string[]).includes(value);
}

function toListingCondition(v: unknown): ListingCondition {
  if (typeof v !== "string") return ListingCondition.GOOD;
  const candidate = v.trim().toUpperCase();
  return isEnumValue(ListingCondition, candidate)
    ? (candidate as ListingCondition)
    : ListingCondition.GOOD;
}

function toEnergyClass(v: unknown): EnergyClass {
  if (typeof v !== "string") return EnergyClass.C;
  const candidate = v.trim().toUpperCase();
  return isEnumValue(EnergyClass, candidate)
    ? (candidate as EnergyClass)
    : EnergyClass.C;
}

export async function POST(req: Request) {
  const { membership, agency } = await requireAgencyContext();

  if (!canCreate(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateListingBody = {};
  try {
    body = (await req.json()) as CreateListingBody;
  } catch {
    body = {};
  }

  // Required defaults (based on your Prisma model requirements)
  const title = safeString(body.title, "New listing", 120);
  const commune = safeString(body.commune, "Luxembourg", 120);

  const price = safeInt(body.price, 750000, 0);
  const sizeSqm = safeInt(body.sizeSqm, 50, 1);
  const bedrooms = safeInt(body.bedrooms, 1, 0);
  const bathrooms = safeInt(body.bathrooms, 1, 0);

  const condition = toListingCondition(body.condition);
  const energyClass = toEnergyClass(body.energyClass);

  try {
    // ✅ Use a transaction so Listing + PriceHistory are atomic
    const { listingId } = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          agencyId: agency.id,
          agencyName: agency.name ?? undefined,
          title,
          commune,
          price,
          sizeSqm,
          bedrooms,
          bathrooms,
          condition,
          energyClass,
          isPublished: false,
        },
        select: { id: true },
      });

      await tx.listingPriceHistory.create({
        data: { listingId: listing.id, price, recordedAt: new Date() },
      });

      return { listingId: listing.id };
    });

    // ✅ A4: index after commit (keeps search index consistent)
    // If embeddings provider isn't set yet, indexListing will throw; you can choose:
    // - let it fail loudly, or
    // - swallow indexing failures so listing creation still succeeds.
    try {
      await indexListing(listingId);
    } catch (e) {
      console.error("indexListing failed", e);
      // keep create listing successful even if indexing fails
    }

    return NextResponse.json({ id: listingId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
