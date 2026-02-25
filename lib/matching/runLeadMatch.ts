// lib/matching/runLeadMatch.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function scoreStructured(params: {
  profile: any;
  listing: any;
}): { structuredScore: number; reasons: any } {
  const { profile, listing } = params;

  let s = 0;
  const reasons: any = { matched: [], missing: [] };

  // budget
  if (profile.budgetMax != null && listing.price != null) {
    if (listing.price <= profile.budgetMax) {
      s += 20;
      reasons.matched.push("budget");
    } else {
      reasons.missing.push("budget");
    }
  }

  // bedrooms
  if (profile.bedroomsMin != null && listing.bedrooms != null) {
    if (listing.bedrooms >= profile.bedroomsMin) {
      s += 15;
      reasons.matched.push("bedrooms");
    } else {
      reasons.missing.push("bedrooms");
    }
  }

  // bathrooms
  if (profile.bathroomsMin != null && listing.bathrooms != null) {
    if (listing.bathrooms >= profile.bathroomsMin) {
      s += 10;
      reasons.matched.push("bathrooms");
    } else {
      reasons.missing.push("bathrooms");
    }
  }

  // size
  if (profile.sizeMinSqm != null && listing.sizeSqm != null) {
    if (listing.sizeSqm >= profile.sizeMinSqm) {
      s += 10;
      reasons.matched.push("sizeSqm");
    } else {
      reasons.missing.push("sizeSqm");
    }
  }

  // commune
  if (Array.isArray(profile.communes) && profile.communes.length > 0) {
    const ok = profile.communes
      .map((c: string) => c.toLowerCase())
      .includes((listing.commune ?? "").toLowerCase());

    if (ok) {
      s += 20;
      reasons.matched.push("commune");
    } else {
      reasons.missing.push("commune");
    }
  }

  // amenities (currently only buyer-side; listing-side not checked)
  const amenityChecks: Array<[string, boolean | null | undefined]> = [
    ["balcony", profile.hasBalcony],
    ["terrace", profile.hasTerrace],
    ["garden", profile.hasGarden],
    ["cellar", profile.hasCellar],
    ["elevator", profile.hasElevator],
    ["petsAllowed", profile.petsAllowed],
    ["furnished", profile.furnished],
  ];

  for (const [label, required] of amenityChecks) {
    if (required === true) {
      // NOTE: you are awarding points for requirements even before you can verify.
      // Once ListingSearchIndex includes these fields, change this to check listing-side too.
      s += 3;
      reasons.matched.push(label);
    }
  }

  return { structuredScore: s, reasons };
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Buyer embedding as text ('[...,...]') so we can cast to vector in SQL.
 */
async function getBuyerVecText(buyerProfileId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ v: string | null }>>(
      Prisma.sql`
        select embedding::text as v
        from "BuyerProfile"
        where id = ${buyerProfileId}
        limit 1;
      `
    );
    return rows?.[0]?.v ?? null;
  } catch {
    return null;
  }
}

function buildStrictWhere(lead: { agencyId: string }, p: any) {
  const where: any = {
    agencyId: lead.agencyId,
    status: "PUBLISHED",
  };

  if (p.kind) where.kind = String(p.kind);
  if (p.propertyType) where.propertyType = String(p.propertyType);

  if (p.budgetMax != null) where.price = { lte: p.budgetMax };
  if (p.budgetMin != null) where.price = { ...(where.price ?? {}), gte: p.budgetMin };

  if (p.sizeMinSqm != null) where.sizeSqm = { gte: p.sizeMinSqm };
  if (p.sizeMaxSqm != null) where.sizeSqm = { ...(where.sizeSqm ?? {}), lte: p.sizeMaxSqm };

  if (p.bedroomsMin != null) where.bedrooms = { gte: p.bedroomsMin };
  if (p.bathroomsMin != null) where.bathrooms = { gte: p.bathroomsMin };

  if (Array.isArray(p.communes) && p.communes.length > 0) {
    where.commune = { in: p.communes };
  }

  return where;
}

function buildRelaxedWheres(strictWhere: any) {
  const relaxed1 = { ...strictWhere };
  delete relaxed1.commune;

  const relaxed2 = { ...relaxed1 };
  delete relaxed2.kind;
  delete relaxed2.propertyType;

  // A final safety net that should basically always return something for the agency,
  // while still keeping "PUBLISHED" and optional budget bounds if present.
  const relaxed3: any = {
    agencyId: strictWhere.agencyId,
    status: strictWhere.status,
  };
  if (strictWhere.price) relaxed3.price = strictWhere.price;

  return [relaxed1, relaxed2, relaxed3] as const;
}

/**
 * Decide weights dynamically.
 *
 * Intuition:
 * - If the search is very constrained (strict) and profile has many structured constraints -> rely more on structured.
 * - If we had to relax a lot (relaxed2/3) or profile is sparse -> rely more on semantic.
 * - If semantic isn't available -> 100% structured.
 */
function computeDynamicWeights(params: {
  usedWhereMode: "strict" | "relaxed1" | "relaxed2" | "relaxed3";
  candidateCount: number;
  profile: any;
  semanticAvailable: boolean;
}): { structuredWeight: number; semanticWeight: number; weightReason: string } {
  const { usedWhereMode, candidateCount, profile, semanticAvailable } = params;

  if (!semanticAvailable) {
    return { structuredWeight: 1, semanticWeight: 0, weightReason: "semantic_unavailable" };
  }

  // Profile "structured richness"
  const hasBudget = profile.budgetMax != null || profile.budgetMin != null;
  const hasBedrooms = profile.bedroomsMin != null;
  const hasBaths = profile.bathroomsMin != null;
  const hasSize = profile.sizeMinSqm != null || profile.sizeMaxSqm != null;
  const hasCommune = Array.isArray(profile.communes) && profile.communes.length > 0;
  const hasKind = Boolean(profile.kind);
  const hasPropertyType = Boolean(profile.propertyType);

  const richness =
    (hasBudget ? 1 : 0) +
    (hasBedrooms ? 1 : 0) +
    (hasBaths ? 1 : 0) +
    (hasSize ? 1 : 0) +
    (hasCommune ? 1 : 0) +
    (hasKind ? 1 : 0) +
    (hasPropertyType ? 1 : 0);

  // Base weights by mode (how much we had to relax)
  let structured = 0.6;
  let semantic = 0.4;
  let weightReason = "default";

  if (usedWhereMode === "strict") {
    structured = 0.7;
    semantic = 0.3;
    weightReason = "strict_filtering";
  } else if (usedWhereMode === "relaxed1") {
    structured = 0.6;
    semantic = 0.4;
    weightReason = "relaxed_commune";
  } else if (usedWhereMode === "relaxed2") {
    structured = 0.45;
    semantic = 0.55;
    weightReason = "relaxed_kind_propertyType";
  } else if (usedWhereMode === "relaxed3") {
    structured = 0.35;
    semantic = 0.65;
    weightReason = "relaxed_to_budget_only";
  }

  // If the profile is sparse, push more weight to semantic.
  if (richness <= 2) {
    structured -= 0.1;
    semantic += 0.1;
    weightReason += "+sparse_profile";
  }

  // If candidate pool is huge, semantic helps more; if tiny, structured matters.
  if (candidateCount >= 500) {
    structured -= 0.1;
    semantic += 0.1;
    weightReason += "+large_pool";
  } else if (candidateCount <= 30) {
    structured += 0.05;
    semantic -= 0.05;
    weightReason += "+small_pool";
  }

  // normalize
  structured = clamp01(structured);
  semantic = clamp01(semantic);
  const sum = structured + semantic;
  if (sum <= 0) return { structuredWeight: 1, semanticWeight: 0, weightReason: "fallback" };

  structured /= sum;
  semantic /= sum;

  return { structuredWeight: structured, semanticWeight: semantic, weightReason };
}

export async function runLeadMatch(params: { leadId: string; topK?: number }) {
  const topK = params.topK ?? 10;

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: {
      id: true,
      agencyId: true,
      buyerProfile: {
        select: {
          id: true,
          scope: true,
          kind: true,
          propertyType: true,
          budgetMin: true,
          budgetMax: true,
          sizeMinSqm: true,
          sizeMaxSqm: true,
          bedroomsMin: true,
          bathroomsMin: true,
          communes: true,
          parkingMin: true,

          hasBalcony: true,
          hasTerrace: true,
          hasGarden: true,
          hasCellar: true,
          hasElevator: true,
          petsAllowed: true,
          furnished: true,
        },
      },
    },
  });

  if (!lead) throw new Error("Lead not found");
  if (!lead.agencyId) throw new Error("Lead has no agencyId");
  if (!lead.buyerProfile) throw new Error("BuyerProfile missing (run profiling first)");

  const p = lead.buyerProfile;

  const strictWhere = buildStrictWhere({ agencyId: lead.agencyId }, p);
  const [relaxed1, relaxed2, relaxed3] = buildRelaxedWheres(strictWhere);

  let usedWhereMode: "strict" | "relaxed1" | "relaxed2" | "relaxed3" = "strict";
  let whereUsed: any = strictWhere;

  const selectFields = {
    listingId: true,
    price: true,
    bedrooms: true,
    bathrooms: true,
    sizeSqm: true,
    commune: true,
    kind: true,
    propertyType: true,
  } as const;

  let candidates = await prisma.listingSearchIndex.findMany({
    where: strictWhere,
    select: selectFields,
    take: 500,
  });

  if (candidates.length === 0) {
    candidates = await prisma.listingSearchIndex.findMany({
      where: relaxed1,
      select: selectFields,
      take: 500,
    });
    usedWhereMode = "relaxed1";
    whereUsed = relaxed1;
  }

  if (candidates.length === 0) {
    candidates = await prisma.listingSearchIndex.findMany({
      where: relaxed2,
      select: selectFields,
      take: 500,
    });
    usedWhereMode = "relaxed2";
    whereUsed = relaxed2;
  }

  if (candidates.length === 0) {
    candidates = await prisma.listingSearchIndex.findMany({
      where: relaxed3,
      select: selectFields,
      take: 500,
    });
    usedWhereMode = "relaxed3";
    whereUsed = relaxed3;
  }

  if (candidates.length === 0) {
    return { ok: true, matched: 0, usedWhereMode, reason: "no_candidates" as const };
  }

  // Structured scoring
  const structured = candidates.map((c) => {
    const { structuredScore, reasons } = scoreStructured({ profile: p, listing: c });
    return { ...c, structuredScore, reasons };
  });

  // ---- Semantic scoring (pgvector) ----
  const buyerVecText = await getBuyerVecText(p.id);
  const semanticById = new Map<string, number>();

  if (buyerVecText) {
    const candidateIds = structured.map((x) => x.listingId);

    try {
      const semRows = await prisma.$queryRaw<Array<{ listingId: string; distance: number }>>(
        Prisma.sql`
          select "listingId", (embedding <=> ${buyerVecText}::vector(1536)) as distance
          from "ListingSearchIndex"
          where "listingId" in (${Prisma.join(candidateIds)})
            and "agencyId" = ${lead.agencyId}
            and status = 'PUBLISHED'
            and embedding is not null
          order by embedding <=> ${buyerVecText}::vector(1536)
          limit ${Math.max(topK * 10, 100)};
        `
      );

      for (const r of semRows) {
        const sim = clamp01(1 - (Number(r.distance) || 0)); // 0..1
        semanticById.set(r.listingId, sim);
      }
    } catch (e) {
      console.error("runLeadMatch semantic query failed; falling back to structured-only", e);
    }
  }

  const semanticAvailable = Boolean(buyerVecText && semanticById.size > 0);

  // ✅ Dynamic weights computed once per run
  const weights = computeDynamicWeights({
    usedWhereMode,
    candidateCount: structured.length,
    profile: p,
    semanticAvailable,
  });

  // Blend scores with dynamic weights
  const blended = structured.map((row) => {
    const semanticSim = semanticById.get(row.listingId) ?? 0; // 0..1
    const semanticScore = semanticSim * 100; // 0..100
    const structuredScore = row.structuredScore;

    const score =
      structuredScore * weights.structuredWeight + semanticScore * weights.semanticWeight;

    return {
      ...row,
      semanticScore,
      score,
      reasons: {
        ...row.reasons,
        meta: {
          ...(row.reasons?.meta ?? {}),
          usedWhereMode,
          semanticUsed: semanticAvailable,
          structuredWeight: weights.structuredWeight,
          semanticWeight: weights.semanticWeight,
          weightReason: weights.weightReason,
          candidateCount: structured.length,
          // helpful if you want to debug what filters were used
          whereUsed,
        },
      },
    };
  });

  blended.sort((a, b) => b.score - a.score);
  const top = blended.slice(0, topK);

  await prisma.$transaction(async (tx) => {
    await tx.leadMatch.deleteMany({ where: { leadId: lead.id } });

    for (const row of top) {
      await tx.leadMatch.create({
        data: {
          agencyId: lead.agencyId!,
          leadId: lead.id,
          listingId: row.listingId,
          scope: lead.buyerProfile!.scope,
          score: row.score,
          structuredScore: row.structuredScore,
          semanticScore: row.semanticScore,
          freshnessScore: null,
          reasons: row.reasons,
        },
      });
    }
  });

  return {
    ok: true,
    matched: top.length,
    usedWhereMode,
    weights,
    candidateCount: structured.length,
  };
}
