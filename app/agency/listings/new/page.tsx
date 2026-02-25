import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import NewListingForm, { type NewListingFormState } from "./_components/NewListingForm";

export const runtime = "nodejs";

type ListingKind = "SALE" | "RENT";
type PropertyType =
  | "APARTMENT"
  | "HOUSE"
  | "STUDIO"
  | "DUPLEX"
  | "PENTHOUSE"
  | "TOWNHOUSE"
  | "ROOM"
  | "OFFICE"
  | "RETAIL"
  | "WAREHOUSE"
  | "LAND"
  | "OTHER";

const PROPERTY_TYPES: PropertyType[] = [
  "APARTMENT",
  "HOUSE",
  "STUDIO",
  "DUPLEX",
  "PENTHOUSE",
  "TOWNHOUSE",
  "ROOM",
  "OFFICE",
  "RETAIL",
  "WAREHOUSE",
  "LAND",
  "OTHER",
];

function asTrimmedString(v: FormDataEntryValue | null, max = 120): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function asIntString(v: FormDataEntryValue | null): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function parseIntSafe(s: string): number | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asEnum<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const up = value.trim().toUpperCase() as T;
  return (allowed as readonly string[]).includes(up) ? up : fallback;
}

export async function createListing(
  _prev: NewListingFormState,
  formData: FormData
): Promise<NewListingFormState> {
  "use server";

  const { agency } = await requireAgencyContext();

  const title = asTrimmedString(formData.get("title"), 120);
  const commune = asTrimmedString(formData.get("commune"), 120);

  const kind = asEnum<ListingKind>(formData.get("kind"), ["SALE", "RENT"], "SALE");
  const propertyType = asEnum<PropertyType>(formData.get("propertyType"), PROPERTY_TYPES, "APARTMENT");

  const priceStr = asIntString(formData.get("price"));
  const sizeStr = asIntString(formData.get("sizeSqm"));
  const bedroomsStr = asIntString(formData.get("bedrooms"));
  const bathroomsStr = asIntString(formData.get("bathrooms"));

  const values = {
    title,
    commune,
    kind,
    propertyType,
    price: priceStr,
    sizeSqm: sizeStr || "50",
    bedrooms: bedroomsStr || "1",
    bathrooms: bathroomsStr || "1",
  };

  const fieldErrors: NewListingFormState["fieldErrors"] = {};

  if (!title) fieldErrors.title = "Title is required.";
  if (!commune) fieldErrors.commune = "Commune is required.";

  const priceN = parseIntSafe(priceStr);
  if (priceN === null) fieldErrors.price = "Enter a number (use 0 for “on request”).";

  const sizeN = parseIntSafe(sizeStr || "50");
  if (sizeN === null || sizeN < 1) fieldErrors.sizeSqm = "Size must be at least 1.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors,
      values,
    };
  }

  const price = clampInt(priceN ?? 0, 0, 50_000_000);
  const sizeSqm = clampInt(sizeN ?? 50, 1, 100_000);
  const bedrooms = clampInt(parseIntSafe(bedroomsStr) ?? 1, 0, 100);
  const bathrooms = clampInt(parseIntSafe(bathroomsStr) ?? 1, 0, 100);

  const listing = await prisma.listing.create({
    data: {
      agencyId: agency.id,
      agencyName: agency.name,

      title,
      commune,
      addressHint: null,

      kind,
      propertyType,

      price,
      sizeSqm,
      bedrooms,
      bathrooms,

      condition: "GOOD",
      energyClass: "D",
      description: null,
    // ✅ lifecycle defaults
      status: "ACTIVE",
      soldAt: null,
      archivedAt: null,
      soldReason: null,

      isPublished: false,
    },
    select: { id: true },
  });

  // Redirect to editor — editor will show prefilled fields from DB
  redirect(`/agency/listings/${listing.id}/edit`);
}

export default async function NewListingPage() {
  const { agency } = await requireAgencyContext();

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/40" />
        <div className="absolute -top-24 right-[-140px] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 left-[-160px] h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">New listing</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {agency.name} · Create a draft and open the editor
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/agency"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Back to dashboard
              </Link>
              <Link
                href="/agency/listings"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                View listings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold">Basics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These values will be saved and prefilled in the editor.
            </p>
          </div>

          <NewListingForm action={createListing} />
        </div>
      </div>
    </main>
  );
}
