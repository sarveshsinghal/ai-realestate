// app/agency/listings/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import ListingsClient from "./ListingsClient";

export default async function AgencyListingsPage() {
  const { agency, membership } = await requireAgencyContext();

  const listings = await prisma.listing.findMany({
    where: { agencyId: agency.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      price: true,
      isPublished: true,
      createdAt: true,

      commune: true,
      sizeSqm: true,
      bedrooms: true,
      kind: true,
      propertyType: true,

      // ✅ lifecycle
      status: true,
      soldAt: true,
      archivedAt: true,
      soldReason: true,

      // ✅ Boost info (NEW)
      boost: {
        select: {
          level: true,
          startsAt: true,
          endsAt: true,
        },
      },

      media: {
        select: { url: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },

      // ✅ lead count
      _count: {
        select: {
          leads: true,
        },
      },
    },
  });

  const canCreate =
    membership.role === "ADMIN" ||
    membership.role === "MANAGER" ||
    membership.role === "AGENT";

  const stats = {
    total: listings.length,
    published: listings.filter((l) => l.isPublished).length,
    draft: listings.filter((l) => !l.isPublished).length,

    // ✅ lifecycle stats
    active: listings.filter((l) => l.status === "ACTIVE").length,
    soldOrUnavailable: listings.filter(
      (l) => l.status === "SOLD" || l.status === "UNAVAILABLE"
    ).length,
    archived: listings.filter((l) => l.status === "ARCHIVED").length,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white shadow-sm">
              <span className="text-sm font-semibold text-neutral-900">🏠</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-neutral-900">
                Listings
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Manage your inventory for{" "}
                <span className="font-medium text-neutral-900">{agency.name}</span>.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatPill label="Total" value={stats.total} />
            <StatPill label="Published" value={stats.published} tone="positive" />
            <StatPill label="Draft" value={stats.draft} tone="neutral" />

            <StatPill label="Active" value={stats.active} tone="positive" />
            <StatPill label="Sold/Unavail." value={stats.soldOrUnavailable} tone="neutral" />
            <StatPill label="Archived" value={stats.archived} tone="neutral" />
          </div>
        </div>

        <div className="flex items-center gap-2 md:pt-1">
          <Link
            href="/agency/leads"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Leads
          </Link>

          {canCreate ? (
            <Link
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              href="/agency/listings/new"
            >
              New listing
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <ListingsClient listings={listings as any} canCreate={canCreate} />
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "neutral";
}) {
  const cls =
    tone === "positive"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "neutral"
      ? "border-neutral-200 bg-neutral-50 text-neutral-800"
      : "border-neutral-200 bg-white text-neutral-900";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${cls}`}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}