// app/(public)/listing/[id]/page.tsx
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BedDouble, Bath, Ruler, Zap, MapPin, Info } from "lucide-react";

import { prisma } from "@/lib/prisma";
import ListingGallery from "@/app/components/public/ListingGallery";
import PriceHistoryChart from "@/app/components/public/PriceHistoryChart";
import ContactCTA from "@/app/components/public/ContactCTA";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { normalizeListingImages } from "@/app/components/public/listing-normalize";

import ListingViewTrackerClient from "@/app/components/public/ListingViewTracker.client";

function formatEUR(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return new Intl.NumberFormat("de-LU", { style: "currency", currency: "EUR" }).format(n);
}

const EPC_LABELS: Record<string, string> = {
  A: "Excellent",
  B: "Very good",
  C: "Good",
  D: "Average",
  E: "Poor",
  F: "Very poor",
};

function formatEPC(v: string | null | undefined) {
  if (!v) return "EPC —";
  const key = String(v).toUpperCase();
  const label = EPC_LABELS[key] ?? "—";
  return `EPC ${key} (${label})`;
}

function statusLabel(status: string | null | undefined) {
  if (!status) return "Unavailable";
  if (status === "SOLD") return "Sold";
  if (status === "UNAVAILABLE") return "No longer available";
  if (status === "ARCHIVED") return "Archived";
  return "Available";
}

export default async function PublicListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      media: {
        orderBy: { sortOrder: "asc" },
        select: { url: true, sortOrder: true },
      },
      priceHistory: {
        orderBy: { recordedAt: "asc" },
        select: { price: true, recordedAt: true },
      },
    },
  });

  // Keep drafts hidden publicly
  if (!listing || !listing.isPublished) return notFound();

  // ✅ Track public listing views (client-side; deduped per day in the client component)
  // Placed AFTER notFound() checks to avoid tracking for non-public/draft listings.
  // Safe: ListingViewTrackerClient is a Client Component.
  const viewTracker = <ListingViewTrackerClient listingId={listing.id} />;

  const isUnavailable =
    listing.status === "SOLD" ||
    listing.status === "UNAVAILABLE" ||
    listing.status === "ARCHIVED";

  // Similar listings (only when unavailable; optional when active)
  const similarListings = isUnavailable
    ? await prisma.listing.findMany({
        where: {
          isPublished: true,
          status: "ACTIVE",
          // try to keep relevance high:
          commune: listing.commune,
          kind: listing.kind,
          propertyType: listing.propertyType,
          // basic price band (+/- 15%). If price is missing, skip price filter.
          ...(typeof listing.price === "number"
            ? {
                price: {
                  gte: Math.floor(listing.price * 0.85),
                  lte: Math.ceil(listing.price * 1.15),
                },
              }
            : {}),
          // don't return itself
          NOT: { id: listing.id },
        },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          commune: true,
          price: true,
          sizeSqm: true,
          bedrooms: true,
          bathrooms: true,
          media: {
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { url: true },
          },
        },
      })
    : [];

  const images = normalizeListingImages(listing);
  const title = listing.title ?? "Listing";
  const commune = listing.commune ?? "";
  const kind = listing.kind ?? "";
  const propertyType = listing.propertyType ?? "";
  const energyClass = listing.energyClass ?? "";

  const pricePoints =
    (listing.priceHistory ?? []).map((p: any) => ({
      price: Number(p.price),
      recordedAt: new Date(p.recordedAt).toISOString(),
    })) ?? [];

  return (
    <div className="space-y-6">
      {/* ✅ View tracker */}
      {viewTracker}

      {/* ✅ Sold/Unavailable banner + ✅ Follow similar homes CTA */}
      {isUnavailable ? (
        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-muted-foreground">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="font-medium">
                This property is {statusLabel(listing.status)}.
              </div>
              <div className="text-sm text-muted-foreground">
                You can still view details, but contacting the agency for this listing is disabled.
                We’ve suggested similar available homes below.
              </div>

              {/* ✅ Step 3B: Follow similar homes */}
              <form action="/api/public/follow-similar" method="post" className="pt-2">
                <input type="hidden" name="listingId" value={listing.id} />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  Follow similar homes
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>

          {kind ? (
            <Badge
              variant="secondary"
              className="rounded-full bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              {kind}
            </Badge>
          ) : null}

          {propertyType ? (
            <Badge variant="outline" className="rounded-full">
              {propertyType}
            </Badge>
          ) : null}

          {isUnavailable ? (
            <Badge variant="destructive" className="rounded-full">
              {statusLabel(listing.status)}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{commune || "Luxembourg"}</span>
        </div>
      </div>

      <ListingGallery images={images} title={title} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-6">
          <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-2xl font-semibold">{formatEUR(listing.price)}</div>

              <div className="flex flex-wrap items-center gap-2">
                <FactPill icon={<BedDouble className="h-4 w-4" />} value={listing.bedrooms ?? 0} label="beds" />
                <FactPill icon={<Bath className="h-4 w-4" />} value={listing.bathrooms ?? 0} label="baths" />
                <FactPill icon={<Ruler className="h-4 w-4" />} value={listing.sizeSqm ?? "—"} label="sqm" />
                <FactPill icon={<Zap className="h-4 w-4" />} value={formatEPC(energyClass)} label="energy" />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="text-foreground font-medium">Condition:</span>{" "}
                {listing.condition ?? "—"}
              </div>
              <div>
                <span className="text-foreground font-medium">Type:</span>{" "}
                {propertyType || "—"}
              </div>
              <div>
                <span className="text-foreground font-medium">Available from:</span>{" "}
                {listing.availableFrom
                  ? new Date(listing.availableFrom).toLocaleDateString("de-LU")
                  : "—"}
              </div>
              <div>
                <span className="text-foreground font-medium">Year built:</span>{" "}
                {listing.yearBuilt ?? "—"}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight">Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {listing.description || "No description provided yet."}
            </p>
          </div>

          <PriceHistoryChart points={pricePoints} />

          <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight">Amenities</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {renderAmenity("Elevator", listing.hasElevator)}
              {renderAmenity("Balcony", listing.hasBalcony)}
              {renderAmenity("Terrace", listing.hasTerrace)}
              {renderAmenity("Garden", listing.hasGarden)}
              {renderAmenity("Cellar", listing.hasCellar)}
              {renderAmenity("Furnished", listing.furnished)}
              {renderAmenity("Pets allowed", listing.petsAllowed)}
              {renderAmenity("Parking", Number(listing.parkingSpaces ?? 0) > 0)}
            </div>
          </div>

          <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight">Location</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px] sm:items-start">
              <div className="text-sm text-muted-foreground">
                {commune ? (
                  <>
                    This property is located in{" "}
                    <span className="text-foreground">{commune}</span>.
                  </>
                ) : (
                  <>Location information is not available.</>
                )}
                {listing.addressHint ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Address hint:{" "}
                    <span className="text-foreground">{listing.addressHint}</span>
                  </div>
                ) : null}
                <div className="mt-2 text-xs text-muted-foreground">
                  Map placeholder (hook in Mapbox/Google later).
                </div>
              </div>
              <div className="aspect-[4/3] overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-50 to-muted/10 dark:from-emerald-950/20">
                <div className="grid h-full place-items-center text-xs text-muted-foreground">
                  Map placeholder
                </div>
              </div>
            </div>
          </div>

          {/* ✅ Similar available homes (only when unavailable) */}
          {isUnavailable ? (
            <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">Similar available homes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on commune, property type and price range.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {similarListings.length ? (
                  similarListings.map((l) => (
                    <a
                      key={l.id}
                      href={`/listing/${l.id}`}
                      className="group rounded-2xl border bg-background p-3 shadow-sm hover:bg-accent/30 transition"
                    >
                      <div className="text-sm font-medium line-clamp-1">{l.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {l.commune} • {l.bedrooms ?? 0}BR • {l.sizeSqm ?? "—"} sqm
                      </div>
                      <div className="mt-2 text-sm font-semibold">{formatEUR(l.price)}</div>
                    </a>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No similar listings found right now.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* ✅ Contact CTA disabled when sold/unavailable */}
        <div className="lg:sticky lg:top-24">
          {isUnavailable ? (
            <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
              <div className="text-sm font-medium">Contact disabled</div>
              <p className="mt-2 text-sm text-muted-foreground">
                This listing is {statusLabel(listing.status)}. Explore similar available homes below.
              </p>
            </div>
          ) : (
            <ContactCTA
              listingId={listing.id}
              listingTitle={title}
              commune={commune}
              priceLabel={formatEUR(listing.price)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FactPill({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm shadow-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function AmenityRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-background px-4 py-3 text-sm shadow-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          enabled
            ? "font-medium text-emerald-700 dark:text-emerald-300"
            : "text-muted-foreground"
        }
      >
        {enabled ? "Yes" : "No"}
      </span>
    </div>
  );
}

function renderAmenity(label: string, flag: any) {
  return <AmenityRow key={label} label={label} enabled={Boolean(flag)} />;
}