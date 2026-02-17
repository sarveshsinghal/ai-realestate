// app/api/agency/listings/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import { deleteListingFolder } from "@/lib/storage/deleteListingFolder";
import { indexListing } from "@/lib/search/indexListing";
import {
  EnergyClass,
  HeatingType,
  ListingCondition,
  ListingKind,
  MemberRole,
  PropertyType,
} from "@prisma/client";

export const runtime = "nodejs";

type UpdateListingBody = {
  title?: string;
  description?: string | null;

  kind?: string;
  propertyType?: string;

  commune?: string;
  addressHint?: string | null;

  price?: number | null;
  sizeSqm?: number;
  bedrooms?: number;
  bathrooms?: number;

  condition?: string;
  energyClass?: string;

  availableFrom?: string | null; // ISO string or null
  yearBuilt?: number | null;
  floor?: number | null;
  totalFloors?: number | null;

  furnished?: boolean;
  petsAllowed?: boolean;

  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  hasCellar?: boolean;
  parkingSpaces?: number | null;

  heatingType?: string | null;

  chargesMonthly?: number | null;
  feesAgency?: number | null;
  deposit?: number | null;
};

function canEdit(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT";
}

function canDelete(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

function isEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value: string
): value is T[keyof T] {
  return (Object.values(enumObj) as string[]).includes(value);
}

function safeString(v: unknown, maxLen: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.slice(0, maxLen);
}

function safeNullableText(v: unknown, maxLen: number): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function safeInt(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== "number") return undefined;
  if (!Number.isFinite(v)) return undefined;
  const n = Math.floor(v);
  return Math.max(min, Math.min(max, n));
}

function safeNullableInt(v: unknown, min: number, max: number): number | null | undefined {
  if (v === null) return null;
  const n = safeInt(v, min, max);
  return n;
}

function safeBool(v: unknown): boolean | undefined {
  if (typeof v !== "boolean") return undefined;
  return v;
}

function safeISODateOrNull(v: unknown): Date | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

async function getScopedListingOrNull(listingId: string, agencyId: string) {
  return prisma.listing.findFirst({
    where: { id: listingId, agencyId },
    select: { id: true, price: true, kind: true },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { membership, agency } = await requireAgencyContext();
  if (!canEdit(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const existing = await getScopedListingOrNull(id, agency.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: UpdateListingBody = {};
  try {
    body = (await req.json()) as UpdateListingBody;
  } catch {
    body = {};
  }

  // Build updateData only with provided, valid values
  const updateData: Record<string, any> = {};

  // strings
  const nextTitle = safeString(body.title, 120);
  if (nextTitle !== undefined) updateData.title = nextTitle;

  const nextDescription = safeNullableText(body.description, 12000);
  if (nextDescription !== undefined) updateData.description = nextDescription;

  const nextCommune = safeString(body.commune, 120);
  if (nextCommune !== undefined) updateData.commune = nextCommune;

  const nextAddressHint = safeNullableText(body.addressHint, 200);
  if (nextAddressHint !== undefined) updateData.addressHint = nextAddressHint;

  // enums
  if (typeof body.kind === "string") {
    const v = body.kind.trim().toUpperCase();
    if (isEnumValue(ListingKind, v)) updateData.kind = v as ListingKind;
  }

  if (typeof body.propertyType === "string") {
    const v = body.propertyType.trim().toUpperCase();
    if (isEnumValue(PropertyType, v)) updateData.propertyType = v as PropertyType;
  }

  if (typeof body.condition === "string") {
    const v = body.condition.trim().toUpperCase();
    if (isEnumValue(ListingCondition, v)) updateData.condition = v as ListingCondition;
  }

  if (typeof body.energyClass === "string") {
    const v = body.energyClass.trim().toUpperCase();
    if (isEnumValue(EnergyClass, v)) updateData.energyClass = v as EnergyClass;
  }

  if (typeof body.heatingType === "string" || body.heatingType === null) {
    if (body.heatingType === null) {
      updateData.heatingType = null;
    } else {
      const v = body.heatingType.trim().toUpperCase();
      if (isEnumValue(HeatingType, v)) updateData.heatingType = v as HeatingType;
    }
  }

  // numbers (core)
  const nextPrice = body.price === null ? null : safeInt(body.price, 0, 50_000_000);
  if (nextPrice !== undefined) updateData.price = nextPrice;

  const nextSizeSqm = safeInt(body.sizeSqm, 1, 100_000);
  if (nextSizeSqm !== undefined) updateData.sizeSqm = nextSizeSqm;

  const nextBedrooms = safeInt(body.bedrooms, 0, 100);
  if (nextBedrooms !== undefined) updateData.bedrooms = nextBedrooms;

  const nextBathrooms = safeInt(body.bathrooms, 0, 100);
  if (nextBathrooms !== undefined) updateData.bathrooms = nextBathrooms;

  const nextParkingSpaces = safeNullableInt(body.parkingSpaces, 0, 100);
  if (nextParkingSpaces !== undefined) updateData.parkingSpaces = nextParkingSpaces;

  // building numbers
  const nextYearBuilt = safeNullableInt(body.yearBuilt, 1700, 2100);
  if (nextYearBuilt !== undefined) updateData.yearBuilt = nextYearBuilt;

  const nextFloor = safeNullableInt(body.floor, -10, 200);
  if (nextFloor !== undefined) updateData.floor = nextFloor;

  const nextTotalFloors = safeNullableInt(body.totalFloors, 0, 200);
  if (nextTotalFloors !== undefined) updateData.totalFloors = nextTotalFloors;

  // dates
  const nextAvailableFrom = safeISODateOrNull(body.availableFrom);
  if (nextAvailableFrom !== undefined) updateData.availableFrom = nextAvailableFrom;

  // booleans
  const furnished = safeBool(body.furnished);
  if (furnished !== undefined) updateData.furnished = furnished;

  const petsAllowed = safeBool(body.petsAllowed);
  if (petsAllowed !== undefined) updateData.petsAllowed = petsAllowed;

  const hasElevator = safeBool(body.hasElevator);
  if (hasElevator !== undefined) updateData.hasElevator = hasElevator;

  const hasBalcony = safeBool(body.hasBalcony);
  if (hasBalcony !== undefined) updateData.hasBalcony = hasBalcony;

  const hasTerrace = safeBool(body.hasTerrace);
  if (hasTerrace !== undefined) updateData.hasTerrace = hasTerrace;

  const hasGarden = safeBool(body.hasGarden);
  if (hasGarden !== undefined) updateData.hasGarden = hasGarden;

  const hasCellar = safeBool(body.hasCellar);
  if (hasCellar !== undefined) updateData.hasCellar = hasCellar;

  // rent fields
  const nextChargesMonthly = safeNullableInt(body.chargesMonthly, 0, 200_000);
  if (nextChargesMonthly !== undefined) updateData.chargesMonthly = nextChargesMonthly;

  const nextFeesAgency = safeNullableInt(body.feesAgency, 0, 200_000);
  if (nextFeesAgency !== undefined) updateData.feesAgency = nextFeesAgency;

  const nextDeposit = safeNullableInt(body.deposit, 0, 5_000_000);
  if (nextDeposit !== undefined) updateData.deposit = nextDeposit;

  // If nothing to update, return early
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: true });
  }

  // price history append if price changed to a concrete number (ignore null clears)
  const priceChanged =
    nextPrice !== undefined &&
    nextPrice !== null &&
    nextPrice !== existing.price;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id },
        data: updateData,
        select: { id: true },
      });

      if (priceChanged) {
        await tx.listingPriceHistory.create({
          data: { listingId: id, price: nextPrice!, recordedAt: new Date() },
        });
      }
    });

    // Reindex after commit (best-effort)
    try {
      await indexListing(id);
    } catch (e) {
      console.error("indexListing failed", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { membership, agency } = await requireAgencyContext();
  if (!canDelete(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const existing = await getScopedListingOrNull(id, agency.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.listingMedia.deleteMany({ where: { listingId: id } });
      await tx.listingPriceHistory.deleteMany({ where: { listingId: id } });
      await tx.listingSearchIndex.deleteMany({ where: { listingId: id } });
      await tx.listing.delete({ where: { id } });
    });

    try {
      await deleteListingFolder(id);
    } catch (e) {
      console.error("deleteListingFolder failed", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
