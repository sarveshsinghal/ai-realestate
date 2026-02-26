// app/api/public/listings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embedText } from "@/lib/search/embeddings";
import { getUserContext } from "@/lib/requireUserContext";

export const runtime = "nodejs";

type Cursor = { offset: number };

function toInt(v: string | null, fallback: number | null = null) {
  if (v == null || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * pgvector expects: "[1,2,3]" not "{1,2,3}".
 */
function toPgVectorLiteral(vec: number[]) {
  const parts = vec.map((x) => (Number.isFinite(Number(x)) ? String(Number(x)) : "0"));
  return `[${parts.join(",")}]`;
}

async function attachUserFlags(listings: any[]) {
  // Add popularityBadge + isSaved for logged-in users
  const ctx = await getUserContext(); // null if logged out
  const ids = listings.map((l) => l.id).filter(Boolean);

  let savedSet = new Set<string>();
  if (ctx && ids.length) {
    const saved = await prisma.wishlistItem.findMany({
      where: { userId: ctx.userId, listingId: { in: ids } },
      select: { listingId: true },
    });
    savedSet = new Set(saved.map((s) => s.listingId));
  }

  return listings.map((l) => ({
    ...l,
    popularityBadge: l?.popularity?.badge ?? l?.popularityBadge ?? "NONE",
    isSaved: savedSet.has(l.id),
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") ?? "").trim();
  const commune = (searchParams.get("commune") ?? "").trim();
  const kind = (searchParams.get("kind") ?? "").trim();
  const propertyType = (searchParams.get("propertyType") ?? "").trim();

  const bedrooms = toInt(searchParams.get("bedrooms"), null);
  const minPrice = toInt(searchParams.get("minPrice"), null);
  const maxPrice = toInt(searchParams.get("maxPrice"), null);
  const minSize = toInt(searchParams.get("minSize"), null);
  const maxSize = toInt(searchParams.get("maxSize"), null);

  const sort = (searchParams.get("sort") ?? "recommended").trim();
  const take = clamp(toInt(searchParams.get("take"), 18) ?? 18, 6, 30);

  let offset = 0;
  const cursorRaw = searchParams.get("cursor");
  if (cursorRaw) {
    try {
      const parsed = JSON.parse(cursorRaw) as Cursor;
      if (typeof parsed?.offset === "number") offset = clamp(parsed.offset, 0, 500);
    } catch {
      // ignore
    }
  }

  // ✅ Always enforce public visibility + ACTIVE lifecycle
  const where: any = { isPublished: true, status: "ACTIVE" };

  if (commune) where.commune = { contains: commune, mode: "insensitive" };
  if (kind) where.kind = kind;
  if (propertyType) where.propertyType = propertyType;
  if (typeof bedrooms === "number") where.bedrooms = { gte: bedrooms };

  if (typeof minPrice === "number" || typeof maxPrice === "number") {
    where.price = {};
    if (typeof minPrice === "number") where.price.gte = minPrice;
    if (typeof maxPrice === "number") where.price.lte = maxPrice;
  }

  if (typeof minSize === "number" || typeof maxSize === "number") {
    where.sizeSqm = {};
    if (typeof minSize === "number") where.sizeSqm.gte = minSize;
    if (typeof maxSize === "number") where.sizeSqm.lte = maxSize;
  }

  // -----------------------------
  // 1) If q exists: TRY hybrid index first
  // -----------------------------
  if (q.length >= 2) {
    try {
      let qvLiteral: string | null = null;
      try {
        const raw = (await embedText(q)).vector as any;
        const arr = Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
        if (arr.length === 1536) qvLiteral = toPgVectorLiteral(arr);
      } catch {
        qvLiteral = null;
      }

      const communes = commune ? [commune] : null;
      const propertyTypes = propertyType ? [propertyType] : null;

      const rows = await prisma.$queryRaw<Array<{ listingId: string; score: number }>>`
        with params as (
          select
            ${q}::text as q,
            ${qvLiteral}::vector(1536) as qv,
            ${minPrice}::int as min_price,
            ${maxPrice}::int as max_price,
            ${bedrooms}::int as bedrooms_min,
            ${communes ?? null}::text[] as communes,
            ${propertyTypes ?? null}::text[] as property_types
        ),
        base as (
          select si.*
          from "ListingSearchIndex" si
          join "Listing" l on l.id = si."listingId"
          , params p
          where si.status = 'PUBLISHED'
            and l."isPublished" = true
            and l."status" = 'ACTIVE'
            and (p.min_price is null or si.price >= p.min_price)
            and (p.max_price is null or si.price <= p.max_price)
            and (p.bedrooms_min is null or si.bedrooms >= p.bedrooms_min)
            and (p.communes is null or si.commune = any(p.communes))
            and (p.property_types is null or si."propertyType" = any(p.property_types))
        ),
        fts as (
          select
            b."listingId",
            ts_rank_cd(b.tsv, websearch_to_tsquery('simple', (select q from params))) as fts_rank
          from base b
          where b.tsv @@ websearch_to_tsquery('simple', (select q from params))
          order by fts_rank desc
          limit 300
        ),
        vec as (
          select
            b."listingId",
            (b.embedding <-> (select qv from params)) as vec_dist
          from base b
          where (select qv from params) is not null
            and b.embedding is not null
          order by vec_dist asc
          limit 300
        ),
        candidates as (
          select
            coalesce(fts."listingId", vec."listingId") as "listingId",
            coalesce(fts.fts_rank, 0) as fts_rank,
            vec.vec_dist as vec_dist
          from fts
          full outer join vec using ("listingId")
        )
        select
          c."listingId",
          (
            0.45 * c.fts_rank
            + 0.55 * coalesce((1.0 / (1.0 + c.vec_dist)), 0)
          )::float8 as score
        from candidates c
        order by score desc
        limit ${take} offset ${offset};
      `;

      const ids = rows.map((r) => r.listingId);
      if (ids.length) {
        const listings = await prisma.listing.findMany({
          where: { id: { in: ids }, isPublished: true, status: "ACTIVE" },
          include: {
            media: { orderBy: { sortOrder: "asc" }, select: { url: true, sortOrder: true } },
            popularity: { select: { badge: true, score7d: true } },
          },
        });

        const byId = new Map(listings.map((l: any) => [l.id, l]));
        const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

        const items = await attachUserFlags(ordered);

        return NextResponse.json({
          items,
          nextCursor: { offset: offset + take },
          hasMore: items.length === take,
          meta: { mode: "hybrid" },
        });
      }
    } catch (e) {
      console.error("[public/listings] hybrid failed, falling back to prisma:", e);
    }

    // fallback prisma search
    const fallbackWhere: any = {
      ...where,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { commune: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    };

    const fallbackOrderBy: any =
      sort === "newest"
        ? { updatedAt: "desc" }
        : sort === "price_low"
          ? { price: "asc" }
          : sort === "price_high"
            ? { price: "desc" }
            : { updatedAt: "desc" };

    const rawItems = await prisma.listing.findMany({
      where: fallbackWhere,
      orderBy: fallbackOrderBy,
      skip: offset,
      take,
      include: {
        media: { orderBy: { sortOrder: "asc" }, select: { url: true, sortOrder: true } },
        popularity: { select: { badge: true, score7d: true } },
      },
    });

    const items = await attachUserFlags(rawItems);

    return NextResponse.json({
      items,
      nextCursor: { offset: offset + take },
      hasMore: items.length === take,
      meta: { mode: "prisma_fallback" },
    });
  }

  // -----------------------------
  // 2) No q: normal DB ordering
  // -----------------------------
  const orderBy: any =
    sort === "newest"
      ? { updatedAt: "desc" }
      : sort === "price_low"
        ? { price: "asc" }
        : sort === "price_high"
          ? { price: "desc" }
          : { updatedAt: "desc" };

  const rawItems = await prisma.listing.findMany({
    where,
    orderBy,
    skip: offset,
    take,
    include: {
      media: { orderBy: { sortOrder: "asc" }, select: { url: true, sortOrder: true } },
      popularity: { select: { badge: true, score7d: true } },
    },
  });

  const items = await attachUserFlags(rawItems);

  return NextResponse.json({
    items,
    nextCursor: { offset: offset + take },
    hasMore: items.length === take,
    meta: { mode: "db" },
  });
}