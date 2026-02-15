import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { DealScoreBadge } from "./DealScoreBadge";
import type { Listing } from "@/lib/mockData";
import { dealScore } from "@/lib/scoring";

function formatEUR(n: number) {
  return new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ListingCard({ listing }: { listing: Listing }) {
  const s = dealScore(listing);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="p-0">
        <Link href={`/listing/${listing.id}`} className="block">
          <div className="relative h-48 w-full">
            <Image
              src={listing.images[0]}
              alt={listing.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
              priority={false}
            />
            <div className="absolute top-3 left-3">
              <DealScoreBadge grade={s.grade} />
            </div>
          </div>
        </Link>
      </CardHeader>

      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/listing/${listing.id}`}>
              <h3 className="font-semibold leading-tight line-clamp-2">
                {listing.title}
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground">
              {listing.commune} • {listing.bedrooms} BR • {listing.sizeSqm} m² • EPC{" "}
              {listing.energyClass}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold">{formatEUR(listing.price)}</p>
            <p className="text-xs text-muted-foreground">
              {s.pricePerSqm.toLocaleString("de-LU")} €/m²
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Est. rent</p>
            <p className="font-medium">{formatEUR(s.estMonthlyRent)}/mo</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Gross yield</p>
            <p className="font-medium">{s.estGrossYieldPct}%</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-4 pb-4 pt-0 flex items-center justify-between text-xs text-muted-foreground">
        <span>{listing.agencyName}</span>
        <span>Score: {s.score}/100</span>
      </CardFooter>
    </Card>
  );
}
