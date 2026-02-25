// app/agency/leads/[id]/matches/page.tsx
import { notFound } from "next/navigation";
import LeadMatchPage from "@/components/lead-match/LeadMatchPage";
import { fromDbLeadMatchToUI } from "@/components/lead-match/mappers";
import type { LeadSummary } from "@/components/lead-match/types";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireAgencyContext } from "@/lib/requireAgencyContext";

export const runtime = "nodejs";

type ListingStatusUI = "PUBLISHED" | "DRAFT" | "ARCHIVED";

function toListingStatus(isPublished: boolean | null | undefined): ListingStatusUI {
  return isPublished ? "PUBLISHED" : "DRAFT";
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { agency } = await requireAgencyContext();

  // ✅ params is a Promise in your setup
  const { id: leadId } = await params;

  // 1) Load lead (scoped)
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, agencyId: agency.id },
    select: {
      id: true,
      createdAt: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      message: true,
    },
  });

  if (!lead) return notFound();

  // 2) Load BuyerProfile if exists (safe fallback)
  let buyerProfile: {
    kind: unknown;
    propertyType: unknown;
    budgetMin: number | null;
    budgetMax: number | null;
    bedroomsMin: number | null;
    bedroomsMax: number | null;
    communes: string[];
    queryText?: string | null;
  } | null = null;

  try {
    // @ts-ignore optional model in some schemas
    buyerProfile = await prisma.buyerProfile.findUnique({
      where: { leadId },
      select: {
        kind: true,
        propertyType: true,
        budgetMin: true,
        budgetMax: true,
        bedroomsMin: true,
        bedroomsMax: true,
        communes: true,
        queryText: true,
      },
    });
  } catch {
    buyerProfile = null;
  }

  // 3) Load matches (scoped)
  const dbMatches = await prisma.leadMatch.findMany({
    where: { leadId, agencyId: agency.id },
    orderBy: { score: "desc" },
    take: 200,
    select: {
      id: true,
      listingId: true,
      scope: true,
      score: true,
      structuredScore: true,
      semanticScore: true,
      freshnessScore: true,
      reasons: true,
      createdAt: true,
      listing: {
        select: {
          id: true,
          title: true,
          commune: true,
          price: true,
          bedrooms: true,
          sizeSqm: true,
          isPublished: true,
        },
      },
    },
  });

  const leadSummary: LeadSummary = {
    id: lead.id,
    createdAt: lead.createdAt.toISOString(),
    displayName: lead.name ?? `Lead ${lead.id.slice(0, 6)}`,
    source: null,
    status: (lead.status as any) ?? "NEW",

    kind: (buyerProfile?.kind as any) ?? null,
    propertyType: (buyerProfile?.propertyType as any) ?? null,
    budgetMin: buyerProfile?.budgetMin ?? null,
    budgetMax: buyerProfile?.budgetMax ?? null,
    bedroomsMin: buyerProfile?.bedroomsMin ?? null,
    bedroomsMax: buyerProfile?.bedroomsMax ?? null,
    communes: buyerProfile?.communes ?? [],

    mustHaves: [],
    niceToHaves: [],
    dealBreakers: [],
    profileConfidence: null,
  };

  const matches = dbMatches.map((m) =>
    fromDbLeadMatchToUI({
      id: m.id,
      listingId: m.listingId,
      scope: String(m.scope),

      score: m.score,
      structuredScore: m.structuredScore,
      semanticScore: m.semanticScore,
      freshnessScore: m.freshnessScore ?? null,

      reasons: m.reasons as Prisma.JsonValue,
      createdAt: m.createdAt,

      listing: {
        id: m.listing.id,
        title: m.listing.title,
        commune: m.listing.commune,
        price: m.listing.price,
        bedrooms: m.listing.bedrooms,
        sizeSqm: m.listing.sizeSqm,
        status: toListingStatus(m.listing.isPublished),
      },
    })
  );

  return <LeadMatchPage lead={leadSummary} matches={matches} />;
}
