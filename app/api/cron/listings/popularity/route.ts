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

  // 0) Clear badges for listings that are no longer eligible (SOLD/UNAVAILABLE/ARCHIVED or unpublished)
  // This prevents stale TRENDING badges from sticking forever.
  await prisma.listingPopularity.updateMany({
    where: {
      listing: {
        OR: [{ isPublished: false }, { status: { not: "ACTIVE" } }],
      },
      badge: { not: "NONE" },
    },
    data: { badge: "NONE", score7d: 0, views7d: 0, saves7d: 0, leads7d: 0 },
  });

  // 1) Compute only eligible public listings
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

  // 2) Aggregate saves/views in last 7d
  const savesAgg = await prisma.wishlistItem.groupBy({
    by: ["listingId"],
    where: { listingId: { in: ids }, createdAt: { gte: since } },
    _count: { listingId: true },
  });

  const viewsAgg = await prisma.listingViewEvent.groupBy({
    by: ["listingId"],
    where: { listingId: { in: ids }, createdAt: { gte: since } },
    _count: { listingId: true },
  });

  const saves = new Map(savesAgg.map((r) => [r.listingId, r._count.listingId]));
  const views = new Map(viewsAgg.map((r) => [r.listingId, r._count.listingId]));

  // 3) Score model
  const computed = listings.map((l) => {
    const saves7d = saves.get(l.id) ?? 0;
    const views7d = views.get(l.id) ?? 0;

    const ageDays = Math.floor((now.getTime() - l.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    const recencyBonus = Math.max(0, 7 - ageDays) * 0.5;

    // Simple trustworthy score (tune later):
    const score7d = saves7d * 5 + views7d * 1 + recencyBonus;
    const segmentKey = mkSegmentKey(String(l.kind), String(l.propertyType), String(l.commune));

    return { listingId: l.id, saves7d, views7d, score7d, segmentKey };
  });

  // 4) Group by segment
  const bySegment = new Map<string, typeof computed>();
  for (const r of computed) {
    const arr = bySegment.get(r.segmentKey) ?? [];
    arr.push(r);
    bySegment.set(r.segmentKey, arr);
  }

  // 5) Badge rules (data-backed)
  // - TRENDING: top 10% per segment, with minimum threshold
  // - MOST_SAVED: top 1 per segment (min saves)
  // - MOST_VIEWED: top 1 per segment (min views)
  const MIN_TRENDING_SAVES = 3;
  const MIN_TRENDING_VIEWS = 25;
  const MIN_MOST_SAVED = 5;
  const MIN_MOST_VIEWED = 60;

  const updates: Array<{
    listingId: string;
    saves7d: number;
    views7d: number;
    score7d: number;
    segmentKey: string;
    badge: "NONE" | "TRENDING" | "MOST_SAVED" | "MOST_VIEWED";
  }> = [];

  for (const [segmentKey, rows] of bySegment.entries()) {
    const rowsByScore = [...rows].sort((a, b) => b.score7d - a.score7d);
    const rowsBySaves = [...rows].sort((a, b) => b.saves7d - a.saves7d || b.score7d - a.score7d);
    const rowsByViews = [...rows].sort((a, b) => b.views7d - a.views7d || b.score7d - a.score7d);

    const n = rowsByScore.length;

    // top 10% per segment (min 1)
    const cutoffIndex = Math.min(Math.floor(n * 0.1), n - 1);
    const cutoff = rowsByScore[cutoffIndex]?.score7d ?? Infinity;

    const mostSavedId =
      rowsBySaves[0] && rowsBySaves[0].saves7d >= MIN_MOST_SAVED ? rowsBySaves[0].listingId : null;

    const mostViewedId =
      rowsByViews[0] && rowsByViews[0].views7d >= MIN_MOST_VIEWED ? rowsByViews[0].listingId : null;

    for (const r of rowsByScore) {
      const meetsTrendingMin = r.saves7d >= MIN_TRENDING_SAVES || r.views7d >= MIN_TRENDING_VIEWS;
      const trending = r.score7d > 0 && meetsTrendingMin && r.score7d >= cutoff;

      // Badge priority: MOST_SAVED / MOST_VIEWED trump TRENDING (more specific)
      let badge: "NONE" | "TRENDING" | "MOST_SAVED" | "MOST_VIEWED" = "NONE";
      if (mostSavedId && r.listingId === mostSavedId) badge = "MOST_SAVED";
      else if (mostViewedId && r.listingId === mostViewedId) badge = "MOST_VIEWED";
      else if (trending) badge = "TRENDING";

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

  return NextResponse.json({ ok: true, updated: updates.length, segments: bySegment.size });
}