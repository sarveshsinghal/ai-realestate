// app/api/agency/listings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import {
  BoostLevel,
  EnergyClass,
  ListingCondition,
  ListingKind,
  ListingStatus,
  PropertyType,
} from "@prisma/client";
import { indexListing } from "@/lib/search/indexListing";

export const runtime = "nodejs";

type CreateListingBody = {
  title?: string;
  price?: number;
  commune?: string;
  sizeSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  condition?: string;
  energyClass?: string;

  // ✅ Optional (nice for “create & boost” flows)
  kind?: string; // SALE/RENT
  propertyType?: string; // APARTMENT/HOUSE/...
  description?: string;

  // ✅ Boost (optional)
  boostLevel?: string; // BASIC/PREMIUM/PLATINUM
  boostDays?: number; // default 7
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

function safeText(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function safeInt(v: unknown, fallback: number, min: number): number {
  if (typeof v !== "number") return fallback;
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.floor(v));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function toListingKind(v: unknown): ListingKind {
  if (typeof v !== "string") return ListingKind.SALE;
  const candidate = v.trim().toUpperCase();
  return isEnumValue(ListingKind, candidate)
    ? (candidate as ListingKind)
    : ListingKind.SALE;
}

function toPropertyType(v: unknown): PropertyType {
  if (typeof v !== "string") return PropertyType.APARTMENT;
  const candidate = v.trim().toUpperCase();
  return isEnumValue(PropertyType, candidate)
    ? (candidate as PropertyType)
    : PropertyType.APARTMENT;
}

function toBoostLevel(v: unknown): BoostLevel | null {
  if (typeof v !== "string") return null;
  const candidate = v.trim().toUpperCase();
  return isEnumValue(BoostLevel, candidate) ? (candidate as BoostLevel) : null;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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

  // Optional
  const kind = toListingKind(body.kind);
  const propertyType = toPropertyType(body.propertyType);
  const description = safeText(body.description, 20000);

  // Optional boost
  const boostLevel = toBoostLevel(body.boostLevel); // null = don't create boost
  const boostDays = clamp(safeInt(body.boostDays, 7, 1), 1, 90);

  try {
    const now = new Date();

    // ✅ Atomic create: Listing + PriceHistory (+ optional ListingBoost)
    const created = await prisma.$transaction(async (tx) => {
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

          kind,
          propertyType,
          description: description ?? undefined,

          isPublished: false,
          status: ListingStatus.ACTIVE, // explicit for clarity
        },
        select: { id: true },
      });

      await tx.listingPriceHistory.create({
        data: { listingId: listing.id, price, recordedAt: now },
      });

      // ✅ If requested, create boost row (endsAt is required by schema)
      if (boostLevel) {
        await tx.listingBoost.upsert({
          where: { listingId: listing.id },
          create: {
            listingId: listing.id,
            level: boostLevel,
            startsAt: now,
            endsAt: addDays(now, boostDays),
          },
          update: {
            level: boostLevel,
            // if an existing boost exists, extend from "now"
            startsAt: now,
            endsAt: addDays(now, boostDays),
          },
        });
      }

      return { listingId: listing.id };
    });

    // ✅ Index after commit (keep search index consistent)
    try {
      await indexListing(created.listingId);
    } catch (e) {
      console.error("indexListing failed", e);
      // keep create listing successful even if indexing fails
    }

    return NextResponse.json({
      id: created.listingId,
      boosted: Boolean(boostLevel),
      boostLevel: boostLevel ?? null,
      boostDays: boostLevel ? boostDays : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}