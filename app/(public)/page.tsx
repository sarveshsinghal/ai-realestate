// app/(public)/page.tsx
import Link from "next/link";
import { Sparkles, ShieldCheck, MapPin, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import ListingCard from "@/app/components/ListingCard";
import AISearchBar from "@/app/components/AISearchBar";
import { getUserContext } from "@/lib/requireUserContext";

type CommuneRow = { commune: string; total: number };

export default async function HomePage() {
  const ctx = await getUserContext();
  const userId = ctx?.userId ?? null;

  // --- 0) Determine "top communes this week" dynamically (Option 1)
  // Uses Listing.commune (not segmentKey) to avoid hardcoding and keep it intuitive.
  // We sum score7d over ACTIVE + published listings and take top 3.
  const topCommunes = await prisma.$queryRaw<CommuneRow[]>`
    select
      l.commune as commune,
      sum(lp."score7d")::float8 as total
    from "Listing" l
    join "ListingPopularity" lp on lp."listingId" = l.id
    where l."isPublished" = true
      and l."status" = 'ACTIVE'
      and l.commune is not null
      and btrim(l.commune) <> ''
    group by l.commune
    order by total desc
    limit 3;
  `;

  const communeNames = topCommunes
    .map((r) => (r?.commune ?? "").trim())
    .filter((c) => c.length > 0);

  // Helper: shared include block (performance: only 1 media + wishlist existence)
  const include = {
    media: {
      orderBy: { sortOrder: "asc" as const },
      take: 1,
      select: { url: true, sortOrder: true },
    },
    popularity: { select: { badge: true } },
    wishlistItems: userId ? { where: { userId }, select: { id: true }, take: 1 } : false,
  };

  // Helper: normalization for ListingCard
  const normalize = (rows: any[]) =>
    rows.map((l: any) => ({
      ...l,
      isSaved: userId ? (l.wishlistItems?.length ?? 0) > 0 : false,
      popularityBadge: l?.popularity?.badge ?? "NONE",
      wishlistItems: undefined,
      popularity: undefined,
    }));

  // --- 1) Base shelves (Option 3 + existing)
  const [featuredRaw, trendingRaw, mostSavedRaw, rentalsRaw] = await Promise.all([
    prisma.listing.findMany({
      where: { isPublished: true, status: "ACTIVE" },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
      include,
    }),

    prisma.listing.findMany({
      where: {
        isPublished: true,
        status: "ACTIVE",
        popularity: { is: { badge: "TRENDING" } },
      },
      orderBy: [{ popularity: { score7d: "desc" } }, { updatedAt: "desc" }],
      take: 6,
      include,
    }),

    prisma.listing.findMany({
      where: { isPublished: true, status: "ACTIVE" },
      orderBy: [
        { popularity: { saves7d: "desc" } },
        { popularity: { score7d: "desc" } },
        { updatedAt: "desc" },
      ],
      take: 6,
      include,
    }),

    prisma.listing.findMany({
      where: { isPublished: true, status: "ACTIVE", kind: "RENT" },
      orderBy: [{ popularity: { score7d: "desc" } }, { updatedAt: "desc" }],
      take: 6,
      include,
    }),
  ]);

  // --- 2) Hot this week in top communes (dynamic shelves)
  // Keep N small to protect performance (3 communes x 1 query each = 3 queries).
  const hotByCommuneRaw = await Promise.all(
    communeNames.map(async (commune) => {
      const items = await prisma.listing.findMany({
        where: {
          isPublished: true,
          status: "ACTIVE",
          commune: { equals: commune, mode: "insensitive" },
        },
        orderBy: [
          { popularity: { score7d: "desc" } },
          { popularity: { saves7d: "desc" } },
          { updatedAt: "desc" },
        ],
        take: 6,
        include,
      });

      return { commune, items };
    })
  );

  const featured = normalize(featuredRaw);
  const trending = normalize(trendingRaw);
  const mostSaved = normalize(mostSavedRaw);
  const rentals = normalize(rentalsRaw);
  const hotByCommune = hotByCommuneRaw.map((x) => ({ commune: x.commune, items: normalize(x.items) }));

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
      <Section
        title="Featured listings"
        subtitle="Recently updated, published listings."
        ctaHref="/listings"
        ctaText="View all"
      >
        <Grid listings={featured} />
      </Section>

      {/* Trending Now */}
      <Section
        title="🔥 Trending Now"
        subtitle="Most popular listings right now (last 7 days)."
        ctaHref="/trending"
        ctaText="View trending"
      >
        {trending.length === 0 ? (
          <EmptyCard text="No trending listings yet — once your popularity cron assigns the TRENDING badge, they’ll appear here." />
        ) : (
          <Grid listings={trending} />
        )}
      </Section>

      {/* Hot this week in top communes */}
      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">🗺️ Hot this week</h2>
            <p className="text-sm text-muted-foreground">
              Top communes by recent interest, updated automatically.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/listings?sort=recommended">Explore</Link>
          </Button>
        </div>

        {hotByCommune.length === 0 ? (
          <EmptyCard text="Not enough activity yet to determine hot communes. This will populate as users browse and save." />
        ) : (
          <div className="space-y-8">
            {hotByCommune.map(({ commune, items }) => (
              <Section
                key={commune}
                title={`Hot in ${commune}`}
                subtitle="Ranked by recent saves + views (decayed)."
                ctaHref={`/listings?commune=${encodeURIComponent(commune)}&sort=recommended`}
                ctaText="View"
                compact
              >
                {items.length === 0 ? (
                  <EmptyCard text={`No active published listings found for ${commune}.`} />
                ) : (
                  <Grid listings={items} />
                )}
              </Section>
            ))}
          </div>
        )}
      </section>

      {/* Most saved */}
      <Section
        title="💾 Most saved this week"
        subtitle="Listings people are bookmarking right now."
        ctaHref="/listings?sort=recommended"
        ctaText="Explore"
      >
        {mostSaved.length === 0 ? (
          <EmptyCard text="No saved activity yet — once users start saving, this shelf will populate." />
        ) : (
          <Grid listings={mostSaved} />
        )}
      </Section>

      {/* Trending rentals */}
      <Section
        title="🏠 Trending rentals"
        subtitle="Rentals ranked by recent activity."
        ctaHref="/listings?kind=RENT&sort=recommended"
        ctaText="View rentals"
      >
        {rentals.length === 0 ? (
          <EmptyCard text="No rentals yet (published + active)." />
        ) : (
          <Grid listings={rentals} />
        )}
      </Section>
    </div>
  );
}

function Grid({ listings }: { listings: any[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing: any) => (
        <ListingCard key={listing.id} listing={listing} href={`/listing/${listing.id}`} />
      ))}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border bg-background/70 p-6 text-sm text-muted-foreground shadow-sm">
      {text}
    </div>
  );
}

function Section({
  title,
  subtitle,
  ctaHref,
  ctaText,
  children,
  compact,
}: {
  title: string;
  subtitle: string;
  ctaHref: string;
  ctaText: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "space-y-4" : "space-y-4"}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className={compact ? "text-lg font-semibold tracking-tight" : "text-xl font-semibold tracking-tight"}>
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href={ctaHref}>{ctaText}</Link>
        </Button>
      </div>
      {children}
    </section>
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