// app/components/ListingCard.tsx
import Link from "next/link";
import Image from "next/image";
import { MapPin, BedDouble, Bath, Ruler } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import WishlistButtonClient from "@/app/components/public/WishlistButton.client";

import { normalizeListingImages } from "@/app/components/public/listing-normalize";

function formatPriceEUR(n: number | null) {
  if (!n || n <= 0) return "Price on request";
  try {
    return new Intl.NumberFormat("de-LU", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `€${Math.round(n).toLocaleString()}`;
  }
}

function humanizeEPC(v: string | null | undefined) {
  if (!v) return "Energy —";
  const key = String(v).toUpperCase();

  const map: Record<string, string> = {
    A: "Energy: Excellent",
    B: "Energy: Very good",
    C: "Energy: Good",
    D: "Energy: Average",
    E: "Energy: Poor",
    F: "Energy: Very poor",
  };

  return map[key] ?? "Energy —";
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

export default function ListingCard({
  listing,
  href,
  className,
}: {
  listing: any;
  href: string;
  className?: string;
}) {
  const images = normalizeListingImages(listing);
  const img = images[0];

  const title = listing?.title ?? "Listing";
  const commune = listing?.commune ?? "";
  const bedrooms = typeof listing?.bedrooms === "number" ? listing.bedrooms : null;
  const bathrooms = typeof listing?.bathrooms === "number" ? listing.bathrooms : null;
  const sizeSqm = typeof listing?.sizeSqm === "number" ? listing.sizeSqm : null;
  const kind = listing?.kind ?? null; // SALE | RENT
  const price = listing?.price ?? null;

  return (
    <Link
      href={href}
      className={cn(
        "group block overflow-hidden rounded-3xl border bg-background shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={img}
          alt={title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* soft gradient for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0 opacity-90" />

        {/* top badges */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          {kind ? (
            <Badge className="rounded-full bg-background/85 text-foreground backdrop-blur">
              {String(kind).toUpperCase()}
            </Badge>
          ) : null}

          {listing?.energyClass ? (
            <Badge className="rounded-full bg-background/85 text-foreground backdrop-blur">
              {humanizeEPC(listing.energyClass)}
            </Badge>
          ) : null}
        </div>

        {/* wishlist */}
        <div className="absolute right-4 top-4">
          <WishlistButtonClient listingId={listing.id} />
        </div>

        {/* bottom price */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white drop-shadow-sm">
              {title}
            </div>
            {commune ? (
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-white/90 drop-shadow-sm">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{commune}</span>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <div className="text-base font-semibold text-white drop-shadow-sm">
              {formatPriceEUR(price)}
            </div>
          </div>
        </div>
      </div>

      {/* content */}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {typeof bedrooms === "number" ? (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-4 w-4" />
              {bedrooms} bed
            </span>
          ) : null}

          {typeof bathrooms === "number" ? (
            <span className="inline-flex items-center gap-1">
              <Bath className="h-4 w-4" />
              {bathrooms} bath
            </span>
          ) : null}

          {typeof sizeSqm === "number" ? (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-4 w-4" />
              {sizeSqm} m²
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}