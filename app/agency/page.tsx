// app/agency/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { dealScore } from "@/lib/scoring";
import { toScoringListing } from "@/lib/scoringAdapter";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "VIEWING" | "OFFER" | "WON" | "LOST";

const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "OFFER",
  "WON",
  "LOST",
];

function formatEUR(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return new Intl.NumberFormat("de-LU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(isoOrDate: string | Date) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function timeAgo(iso: string) {
  const from = new Date(iso);
  const s = Math.max(0, Math.floor((Date.now() - from.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return formatDate(from);
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function statusPillClass(status: LeadStatus) {
  switch (status) {
    case "NEW":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "CONTACTED":
      return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "QUALIFIED":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "VIEWING":
      return "border-violet-200 bg-violet-50 text-violet-950";
    case "OFFER":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "WON":
      return "border-green-200 bg-green-50 text-green-900";
    case "LOST":
      return "border-rose-200 bg-rose-50 text-rose-900";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-900";
  }
}

function gradePillClass(grade: string) {
  if (grade === "A") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (grade === "B") return "border-green-200 bg-green-50 text-green-900";
  if (grade === "C") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-rose-200 bg-rose-50 text-rose-900";
}

function publishedPill(isPublished: boolean) {
  return isPublished
    ? "border-green-200 bg-green-50 text-green-800"
    : "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default async function AgencyDashboard() {
  const { agency } = await requireAgencyContext();

  const [listings, leadsCount, publishedCount, leadStatusGroups, recentLeads] =
    await Promise.all([
      prisma.listing.findMany({
        where: { agencyId: agency.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          commune: true,
          price: true,
          sizeSqm: true,
          bedrooms: true,
          bathrooms: true,
          condition: true,
          energyClass: true,
          isPublished: true,
          createdAt: true,
        },
        take: 50,
      }),
      prisma.lead.count({ where: { agencyId: agency.id } }),
      prisma.listing.count({ where: { agencyId: agency.id, isPublished: true } }),
      prisma.lead.groupBy({
        by: ["status"],
        where: { agencyId: agency.id },
        _count: { _all: true },
      }),
      prisma.lead.findMany({
        where: { agencyId: agency.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          message: true,
          status: true,
          createdAt: true,
          listingId: true,
          listing: {
            select: { id: true, title: true, commune: true },
          },
        },
      }),
    ]);

  // Lead status counts (safe defaults)
  const statusCounts: Record<LeadStatus, number> = {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    VIEWING: 0,
    OFFER: 0,
    WON: 0,
    LOST: 0,
  };

  for (const g of leadStatusGroups) {
    const s = String(g.status) as LeadStatus;
    if (LEAD_STATUSES.includes(s)) statusCounts[s] = g._count._all;
  }

  const funnelTotal = LEAD_STATUSES.reduce((acc, s) => acc + statusCounts[s], 0);
  const maxStatus = Math.max(1, ...LEAD_STATUSES.map((s) => statusCounts[s]));

  // Scoring (your existing logic)
  const scored = listings.map((l) => {
    const scoringListing = toScoringListing({
      id: l.id,
      title: l.title,
      commune: l.commune,
      price: l.price,
      sizeSqm: l.sizeSqm,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      condition: l.condition,
      energyClass: l.energyClass,
    });

    return { listing: l, s: dealScore(scoringListing) };
  });

  const totalListings = listings.length;
  const avgScore =
    totalListings === 0
      ? 0
      : Math.round(scored.reduce((acc, x) => acc + x.s.score, 0) / totalListings);

  const strongDealsA = scored.filter((x) => x.s.grade === "A").length;

  const topDeals = scored
    .slice()
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, 6);

  const needsAttention = scored
    .filter((x) => {
      const l = x.listing;
      const missingBasics =
        !l.title?.trim() || !l.commune?.trim() || !l.sizeSqm || l.sizeSqm <= 0;
      const missingPrice = l.price == null;
      const weakScore = x.s.score < 60;
      return missingBasics || missingPrice || weakScore;
    })
    .slice()
    .sort((a, b) => a.s.score - b.s.score)
    .slice(0, 6);

  const publishRate =
    totalListings === 0 ? 0 : Math.round((publishedCount / totalListings) * 100);

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/40" />
        <div className="absolute -top-24 right-[-140px] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 left-[-160px] h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-card shadow-sm">
                  <span className="text-lg">📊</span>
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">
                    Agency Intelligence
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">{agency.name}</p>
                </div>
              </div>

              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                A clean overview of listings, lead pipeline, and deal scoring — designed for daily use.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">Publish rate</span>
                  <span className="tabular-nums">{publishRate}%</span>
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">Pipeline</span>
                  <span className="tabular-nums">{funnelTotal}</span>
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">Avg score</span>
                  <span className="tabular-nums">{avgScore}/100</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/agency/listings"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Listings
              </Link>
              <Link
                href="/agency/leads"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Leads{" "}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                  {leadsCount}
                </span>
              </Link>
              <Link
                href="/agency/listings/new"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
              >
                + New listing
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Kpi
            title="Total listings"
            value={totalListings}
            sub={`Published: ${publishedCount}`}
            icon="🏠"
          />
          <Kpi
            title="Total leads"
            value={leadsCount}
            sub="All-time inbound"
            icon="🎯"
          />
          <Kpi
            title="Avg deal score"
            value={`${avgScore}/100`}
            sub="Across latest listings"
            icon="✨"
          />
          <Kpi
            title="Strong deals"
            value={strongDealsA}
            sub="Grade A"
            icon="🏆"
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Lead funnel */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Lead pipeline</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Breakdown by status (enum-driven).
                </p>
              </div>
              <div className="rounded-full border bg-muted px-2 py-1 text-xs tabular-nums">
                {funnelTotal}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {LEAD_STATUSES.map((s) => {
                const count = statusCounts[s];
                const w = clamp(Math.round((count / maxStatus) * 100), 0, 100);

                return (
                  <div key={s} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cx(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          statusPillClass(s)
                        )}
                      >
                        {s}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
              Quick win: prioritize <span className="font-medium text-foreground">NEW</span>{" "}
              → <span className="font-medium text-foreground">CONTACTED</span> transitions daily.
            </div>
          </section>

          {/* Top deals */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Top deals</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Highest scoring listings (best candidates to promote).
                </p>
              </div>
              <Link href="/agency/listings" className="text-sm font-medium underline underline-offset-4">
                Manage
              </Link>
            </div>

            {topDeals.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                No listings yet. Create one to start scoring.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3">
                {topDeals.map(({ listing: l, s }) => (
                  <div
                    key={l.id}
                    className="group flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold">
                          {l.title ?? "(Untitled)"}
                        </div>

                        <span
                          className={cx(
                            "rounded-full border px-2 py-0.5 text-xs font-semibold",
                            gradePillClass(s.grade)
                          )}
                        >
                          Grade {s.grade}
                        </span>

                        <span
                          className={cx(
                            "rounded-full border px-2 py-0.5 text-xs font-medium",
                            publishedPill(Boolean(l.isPublished))
                          )}
                        >
                          {l.isPublished ? "Published" : "Draft"}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{l.commune}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>{formatEUR(l.price)}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>{l.bedrooms} bd</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>{l.sizeSqm} m²</span>
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Created {formatDate(l.createdAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border bg-muted px-3 py-1 text-xs font-semibold tabular-nums">
                        {s.score}/100
                      </span>

                      <Link
                        href={`/agency/listings/${l.id}/edit`}
                        className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                      >
                        Edit
                      </Link>

                      <Link
                        href={`/listing/${l.id}`}
                        className="rounded-xl border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Needs attention */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Needs attention</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quick wins to improve score and conversion.
                </p>
              </div>
              <Link
                href="/agency/listings"
                className="text-sm font-medium underline underline-offset-4"
              >
                Fix
              </Link>
            </div>

            {needsAttention.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                All clear — no urgent issues detected.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {needsAttention.map(({ listing: l, s }) => {
                  const missingBasics =
                    !l.title?.trim() || !l.commune?.trim() || !l.sizeSqm || l.sizeSqm <= 0;
                  const missingPrice = l.price == null;
                  const weakScore = s.score < 60;

                  return (
                    <div key={l.id} className="rounded-xl border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold">
                              {l.title ?? "(Untitled)"}
                            </div>
                            <span
                              className={cx(
                                "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                gradePillClass(s.grade)
                              )}
                            >
                              {s.score}/100
                            </span>
                            <span
                              className={cx(
                                "rounded-full border px-2 py-0.5 text-xs font-medium",
                                publishedPill(Boolean(l.isPublished))
                              )}
                            >
                              {l.isPublished ? "Published" : "Draft"}
                            </span>
                          </div>

                          <div className="mt-1 text-sm text-muted-foreground">
                            {l.commune} • {formatEUR(l.price)} • {l.bedrooms} bd • {l.sizeSqm} m²
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {missingBasics ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-900">
                                Missing required fields
                              </span>
                            ) : null}
                            {missingPrice ? (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">
                                Price missing
                              </span>
                            ) : null}
                            {weakScore ? (
                              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-800">
                                Score below 60
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <Link
                          href={`/agency/listings/${l.id}/edit`}
                          className="shrink-0 rounded-xl border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent leads */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Recent leads</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Latest inbound — copy contact and jump to listing.
                </p>
              </div>
              <Link
                href="/agency/leads"
                className="text-sm font-medium underline underline-offset-4"
              >
                View all
              </Link>
            </div>

            {recentLeads.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                No leads yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {recentLeads.map((l) => {
                  const st = String(l.status) as LeadStatus;
                  const listingTitle = l.listing?.title ?? (l.listingId ? "Listing linked" : "Unassigned");
                  const listingCommune = l.listing?.commune ?? "";

                  return (
                    <div key={l.id} className="rounded-xl border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold">{l.name}</div>

                            <span
                              className={cx(
                                "rounded-full border px-2 py-0.5 text-xs font-medium",
                                statusPillClass(st)
                              )}
                            >
                              {st}
                            </span>

                            <span className="text-xs text-muted-foreground">
                              {timeAgo(l.createdAt.toISOString())}
                            </span>
                          </div>

                          <div className="mt-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{listingTitle}</span>
                            {listingCommune ? (
                              <span className="text-muted-foreground"> • {listingCommune}</span>
                            ) : null}
                          </div>

                          {l.message ? (
                            <div className="mt-2 line-clamp-2 text-sm text-foreground/90">
                              “{l.message}”
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                            <a
                              href={`mailto:${l.email}`}
                              className="rounded-xl border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
                              title="Email"
                            >
                              ✉️ Email
                            </a>

                            {l.phone ? (
                              <a
                                href={`tel:${l.phone}`}
                                className="rounded-xl border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
                                title="Call"
                              >
                                📞 Call
                              </a>
                            ) : null}

                            {l.listingId ? (
                              <Link
                                href={`/agency/listings/${l.listingId}/edit`}
                                className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                                title="Open listing"
                              >
                                Open listing
                              </Link>
                            ) : (
                              <Link
                                href="/agency/leads"
                                className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                              >
                                Open leads
                              </Link>
                            )}
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full border bg-muted px-2 py-1 text-xs tabular-nums">
                          {formatDate(l.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Bottom CTA strip */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Next best actions</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                If you want immediate impact, fix the “Needs attention” items and push top deals live.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/agency/listings"
                className="rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Review listings
              </Link>
              <Link
                href="/agency/leads"
                className="rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Work pipeline
              </Link>
              <Link
                href="/agency/listings/new"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
              >
                Create listing
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi(props: { title: string; value: React.ReactNode; sub: string; icon: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{props.title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{props.value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{props.sub}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border bg-muted text-lg">
          {props.icon}
        </div>
      </div>
    </div>
  );
}
