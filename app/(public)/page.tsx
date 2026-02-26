// app/(public)/page.tsx
import Link from "next/link";
import { Sparkles, ShieldCheck, MapPin, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import ListingCard from "@/app/components/ListingCard";
import AISearchBar from "@/app/components/AISearchBar";
import { getUserContext } from "@/lib/requireUserContext";

export default async function HomePage() {
  const ctx = await getUserContext();
  const userId = ctx?.userId ?? null;

  const featuredRaw = await prisma.listing.findMany({
    where: { isPublished: true, status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }],
    take: 6,
    include: {
      media: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true, sortOrder: true },
      },
      popularity: { select: { badge: true } }, // ✅ include popularity
      wishlistItems: userId
        ? { where: { userId }, select: { id: true }, take: 1 }
        : false,
    },
  });

  // ✅ Normalize shape for ListingCard
  const featured = featuredRaw.map((l: any) => ({
    ...l,
    isSaved: userId ? (l.wishlistItems?.length ?? 0) > 0 : false,
    popularityBadge: l?.popularity?.badge ?? "NONE", // ✅ critical fix
    wishlistItems: undefined,
    popularity: undefined,
  }));

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-emerald-50/40 p-6 shadow-sm sm:p-10 dark:to-emerald-950/20">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-900/25" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-900/20" />

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-4">
            <Badge className="w-fit rounded-full bg-background/70 text-foreground hover:bg-background/70">
              <Sparkles className="mr-2 h-4 w-4 text-emerald-600" />
              Premium marketplace + agency portal
            </Badge>

            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Find a home in Luxembourg—beautifully.
            </h1>

            <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Search naturally in English, French, German, or Luxembourgish.
              EstateIQ ranks results using semantic understanding + filters.
            </p>

            <AISearchBar />

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                asChild
                className="h-11 rounded-full px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Link href="/listings">
                  Browse listings <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-11 rounded-full px-6">
                <Link href="/agency">
                  Agency portal <ShieldCheck className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Pill icon={<MapPin className="h-4 w-4" />} text="Commune-first" />
              <Pill icon={<ShieldCheck className="h-4 w-4" />} text="Published only" />
              <Pill icon={<Sparkles className="h-4 w-4" />} text="Hybrid AI ranking" />
            </div>
          </div>

          <div className="relative rounded-3xl border bg-background/75 p-5 shadow-sm">
            <div className="text-sm font-semibold">Quick start</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Browse with filters and “Load more”.
            </div>

            <div className="mt-4 grid gap-3">
              <Button asChild variant="secondary" className="h-11 rounded-2xl justify-between">
                <Link href="/listings?q=Kirchberg">
                  Search “Kirchberg” <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-11 rounded-2xl justify-between">
                <Link href="/listings?kind=SALE">
                  Browse for sale <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-11 rounded-2xl justify-between">
                <Link href="/listings?kind=RENT">
                  Browse for rent <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              Tip: Publish listings in Agency → they show here.
            </div>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Featured listings</h2>
            <p className="text-sm text-muted-foreground">
              Recently updated, published listings.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/listings">View all</Link>
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((listing: any) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              href={`/listing/${listing.id}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Pill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 shadow-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span>{text}</span>
    </div>
  );
}