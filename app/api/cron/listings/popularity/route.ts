// app/api/cron/listings/popularity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function cronOk(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  return header === secret;
}

function mkSegmentKey(kind: string | null, propertyType: string | null, commune: string | null) {
  return `${String(kind ?? "")}|${String(propertyType ?? "")}|${String(commune ?? "")}`.toLowerCase();
}

export async function POST(req: NextRequest) {
  if (!cronOk(req)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Decay settings (advanced ranking)
  // Half-life ≈ 3 days => lambda = ln(2)/3
  const HALF_LIFE_DAYS = 3;
  const LAMBDA = Math.log(2) / HALF_LIFE_DAYS; // ~0.231

  // 0) Clear badges for listings that are no longer eligible
  await prisma.listingPopularity.updateMany({
    where: {
      listing: {
        OR: [{ isPublished: false }, { status: { not: "ACTIVE" } }],
      },
      badge: { not: "NONE" },
    },
    data: { badge: "NONE", score7d: 0, views7d: 0, saves7d: 0, leads7d: 0 },
  });

  // 1) Eligible public listings
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE", isPublished: true },
    select: {
      id: true,
      createdAt: true,
      kind: true,
      propertyType: true,
      commune: true,
    },
  });

  const ids = listings.map((l) => l.id);
  if (!ids.length) return NextResponse.json({ ok: true, updated: 0 });

  /**
   * 2) Aggregate saves/views in last 7d with decay
   * We compute both:
   * - count7d (raw) for transparency + thresholds
   * - weight7d (decayed) for scoring
   *
   * weight7d = Σ exp( -LAMBDA * age_days )
   * age_days = (now - createdAt) in days
   */
  const [savesAgg, viewsAgg] = await Promise.all([
    prisma.$queryRaw<Array<{ listingId: string; count7d: bigint; weight7d: number }>>`
      select
        wi."listingId" as "listingId",
        count(*) as "count7d",
        coalesce(
          sum(
            exp(
              -${LAMBDA}::float8
              * (extract(epoch from (now() - wi."createdAt")) / 86400.0)
            )
          ),
          0
        )::float8 as "weight7d"
      from "WishlistItem" wi
      where wi."listingId" = any(${ids}::text[])
        and wi."createdAt" >= ${since}
      group by wi."listingId";
    `,
    prisma.$queryRaw<Array<{ listingId: string; count7d: bigint; weight7d: number }>>`
      select
        ve."listingId" as "listingId",
        count(*) as "count7d",
        coalesce(
          sum(
            exp(
              -${LAMBDA}::float8
              * (extract(epoch from (now() - ve."createdAt")) / 86400.0)
            )
          ),
          0
        )::float8 as "weight7d"
      from "ListingViewEvent" ve
      where ve."listingId" = any(${ids}::text[])
        and ve."createdAt" >= ${since}
      group by ve."listingId";
    `,
  ]);

  const savesCount = new Map<string, number>();
  const savesWeight = new Map<string, number>();
  for (const r of savesAgg) {
    savesCount.set(r.listingId, Number(r.count7d ?? 0));
    savesWeight.set(r.listingId, Number(r.weight7d ?? 0));
  }

  const viewsCount = new Map<string, number>();
  const viewsWeight = new Map<string, number>();
  for (const r of viewsAgg) {
    viewsCount.set(r.listingId, Number(r.count7d ?? 0));
    viewsWeight.set(r.listingId, Number(r.weight7d ?? 0));
  }

  // 3) Score model (decayed)
  const computed = listings.map((l) => {
    const saves7d = savesCount.get(l.id) ?? 0;
    const views7d = viewsCount.get(l.id) ?? 0;

    const savesW7d = savesWeight.get(l.id) ?? 0;
    const viewsW7d = viewsWeight.get(l.id) ?? 0;

    const ageDays = Math.floor((now.getTime() - l.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    const recencyBonus = Math.max(0, 7 - ageDays) * 0.5;

    // Use decayed weights for score so recent activity dominates.
    // Raw counts are still stored for thresholds + transparency.
    const score7d = savesW7d * 5 + viewsW7d * 1 + recencyBonus;

    const segmentKey = mkSegmentKey(String(l.kind), String(l.propertyType), String(l.commune));

    return {
      listingId: l.id,
      saves7d,
      views7d,
      score7d,
      segmentKey,
    };
  });

  // 4) Group by segment
  const bySegment = new Map<string, typeof computed>();
  for (const r of computed) {
    const arr = bySegment.get(r.segmentKey) ?? [];
    arr.push(r);
    bySegment.set(r.segmentKey, arr);
  }

  // 5) Badge rules (tuned to avoid "empty trending")
  const MIN_TRENDING_SAVES = 2;
  const MIN_TRENDING_VIEWS = 15;
  const MIN_MOST_SAVED = 5;
  const MIN_MOST_VIEWED = 60;

  const SMALL_SEGMENT_N = 8;
  const SMALL_SEGMENT_TRENDING_COUNT = 1;
  const GLOBAL_TRENDING_FALLBACK_COUNT = 12;

  const updates: Array<{
    listingId: string;
    saves7d: number;
    views7d: number;
    score7d: number;
    segmentKey: string;
    badge: "NONE" | "TRENDING" | "MOST_SAVED" | "MOST_VIEWED";
  }> = [];

  const trendingSet = new Set<string>();

  for (const [segmentKey, rows] of bySegment.entries()) {
    const rowsByScore = [...rows].sort((a, b) => b.score7d - a.score7d);
    const rowsBySaves = [...rows].sort((a, b) => b.saves7d - a.saves7d || b.score7d - a.score7d);
    const rowsByViews = [...rows].sort((a, b) => b.views7d - a.views7d || b.score7d - a.score7d);

    const n = rowsByScore.length;

    let cutoff = Infinity;
    if (n <= SMALL_SEGMENT_N) {
      cutoff =
        rowsByScore[Math.min(SMALL_SEGMENT_TRENDING_COUNT - 1, n - 1)]?.score7d ?? Infinity;
    } else {
      const cutoffIndex = Math.min(Math.max(Math.ceil(n * 0.1) - 1, 0), n - 1);
      cutoff = rowsByScore[cutoffIndex]?.score7d ?? Infinity;
    }

    const mostSavedId =
      rowsBySaves[0] && rowsBySaves[0].saves7d >= MIN_MOST_SAVED ? rowsBySaves[0].listingId : null;

    const mostViewedId =
      rowsByViews[0] && rowsByViews[0].views7d >= MIN_MOST_VIEWED ? rowsByViews[0].listingId : null;

    for (const r of rowsByScore) {
      const meetsTrendingMin = r.saves7d >= MIN_TRENDING_SAVES || r.views7d >= MIN_TRENDING_VIEWS;
      const trending = r.score7d > 0 && meetsTrendingMin && r.score7d >= cutoff;

      let badge: "NONE" | "TRENDING" | "MOST_SAVED" | "MOST_VIEWED" = "NONE";
      if (mostSavedId && r.listingId === mostSavedId) badge = "MOST_SAVED";
      else if (mostViewedId && r.listingId === mostViewedId) badge = "MOST_VIEWED";
      else if (trending) badge = "TRENDING";

      if (badge === "TRENDING") trendingSet.add(r.listingId);

      updates.push({
        listingId: r.listingId,
        saves7d: r.saves7d,
        views7d: r.views7d,
        score7d: r.score7d,
        segmentKey,
        badge,
      });
    }
  }

  // Global fallback if absolutely nothing is TRENDING
  if (trendingSet.size === 0) {
    const globalSorted = [...computed].sort((a, b) => b.score7d - a.score7d);
    const fallbackIds: string[] = [];

    for (const r of globalSorted) {
      const meetsTrendingMin = r.saves7d >= MIN_TRENDING_SAVES || r.views7d >= MIN_TRENDING_VIEWS;
      if (r.score7d > 0 && meetsTrendingMin) fallbackIds.push(r.listingId);
      if (fallbackIds.length >= GLOBAL_TRENDING_FALLBACK_COUNT) break;
    }

    if (fallbackIds.length) {
      for (const u of updates) {
        if (!fallbackIds.includes(u.listingId)) continue;
        if (u.badge === "MOST_SAVED" || u.badge === "MOST_VIEWED") continue;
        u.badge = "TRENDING";
      }
    }
  }

  // 6) Upsert popularity rows
  await prisma.$transaction(
    updates.map((u) =>
      prisma.listingPopularity.upsert({
        where: { listingId: u.listingId },
        update: {
          saves7d: u.saves7d,
          views7d: u.views7d,
          score7d: u.score7d,
          segmentKey: u.segmentKey,
          badge: u.badge,
        },
        create: {
          listingId: u.listingId,
          saves7d: u.saves7d,
          views7d: u.views7d,
          score7d: u.score7d,
          leads7d: 0,
          segmentKey: u.segmentKey,
          badge: u.badge,
        },
      })
    )
  );

  return NextResponse.json({
    ok: true,
    updated: updates.length,
    segments: bySegment.size,
    decay: { halfLifeDays: HALF_LIFE_DAYS },
  });
}