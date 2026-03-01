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

function toPgVectorLiteral(vec: number[]) {
  const parts = vec.map((x) => (Number.isFinite(Number(x)) ? String(Number(x)) : "0"));
  return `[${parts.join(",")}]`;
}

async function attachUserFlags(listings: any[]) {
  const ctx = await getUserContext();
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
    // optional convenience flag for UI
    isBoosted:
      l?.boost?.endsAt ? new Date(l.boost.endsAt).getTime() > Date.now() : false,
  }));
}

function getOrderBy(sort: string) {
  if (sort === "recommended") {
    return [
      { popularity: { score7d: "desc" as const } },
      { popularity: { saves7d: "desc" as const } },
      { updatedAt: "desc" as const },
    ];
  }

  if (sort === "newest") return { updatedAt: "desc" as const };
  if (sort === "price_low") return { price: "asc" as const };
  if (sort === "price_high") return { price: "desc" as const };

  return { updatedAt: "desc" as const };
}

const includePublic = {
  media: { orderBy: { sortOrder: "asc" as const }, select: { url: true, sortOrder: true } },
  popularity: { select: { badge: true, score7d: true, saves7d: true } },
  boost: { select: { level: true, startsAt: true, endsAt: true } }, // ✅ added
};

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
  const badge = (searchParams.get("badge") ?? "").trim();
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

  if (badge) {
    where.popularity = { is: { badge } };
  }

  // -----------------------------
  // 1) q exists => hybrid first
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

      const POP_K = 50;
      const POP_WEIGHT = 0.08;

      const SAVE_K = 4;
      const SAVE_WEIGHT = 0.10;

      const BOOST_WEIGHT = 0.35;

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
        ),
        pop as (
          select lp."listingId", coalesce(lp."score7d", 0)::float8 as score7d
          from "ListingPopularity" lp
        ),
        saves as (
          select wi."listingId", count(*)::float8 as saves7d
          from "WishlistItem" wi
          where wi."createdAt" >= now() - interval '7 days'
          group by wi."listingId"
        ),
        boost as (
          select
            b."listingId",
            case
              when now() between b."startsAt" and b."endsAt" then
                case b."level"
                  when 'BASIC' then 0.45
                  when 'PREMIUM' then 0.70
                  when 'PLATINUM' then 1.00
                  else 0
                end
              else 0
            end::float8 as boost_scalar
          from "ListingBoost" b
        )
        select
          c."listingId",
          (
            0.45 * c.fts_rank
            + 0.55 * coalesce((1.0 / (1.0 + c.vec_dist)), 0)
            + ${POP_WEIGHT} * (1.0 - exp( -coalesce(p.score7d, 0) / ${POP_K} ))
            + ${SAVE_WEIGHT} * (1.0 - exp( -coalesce(s.saves7d, 0) / ${SAVE_K} ))
            + ${BOOST_WEIGHT} * coalesce(x.boost_scalar, 0)
          )::float8 as score
        from candidates c
        left join pop p on p."listingId" = c."listingId"
        left join saves s on s."listingId" = c."listingId"
        left join boost x on x."listingId" = c."listingId"
        order by score desc
        limit ${take} offset ${offset};
      `;

      const ids = rows.map((r) => r.listingId);
      if (ids.length) {
        const listings = await prisma.listing.findMany({
          where: { id: { in: ids }, isPublished: true, status: "ACTIVE" },
          include: includePublic,
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

    const rawItems = await prisma.listing.findMany({
      where: fallbackWhere,
      orderBy: getOrderBy(sort),
      skip: offset,
      take,
      include: includePublic,
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
  // 2) No q: browsing mode
  // -----------------------------

  // ✅ Boost-first Recommended browsing
  if (sort === "recommended") {
    const rows = await prisma.$queryRaw<Array<{ listingId: string }>>`
      with params as (
        select
          ${commune || null}::text as commune,
          ${kind || null}::text as kind,
          ${propertyType || null}::text as property_type,
          ${bedrooms}::int as bedrooms_min,
          ${minPrice}::int as min_price,
          ${maxPrice}::int as max_price,
          ${minSize}::int as min_size,
          ${maxSize}::int as max_size,
          ${badge || null}::text as badge
      ),
      filtered as (
        select
          l.id as "listingId",
          case when b."listingId" is null then 0 else 1 end as boost_active,
          (case b."level"
            when 'PLATINUM' then 3
            when 'PREMIUM' then 2
            when 'BASIC' then 1
            else 0 end
          ) as boost_level_rank,
          coalesce(p."score7d", 0) as score7d,
          coalesce(p."saves7d", 0) as saves7d,
          l."updatedAt" as updatedAt
        from "Listing" l
        left join "ListingBoost" b
          on b."listingId" = l.id
         and now() between b."startsAt" and b."endsAt"
        left join "ListingPopularity" p on p."listingId" = l.id
        , params pa
        where l."isPublished" = true
          and l."status" = 'ACTIVE'
          and (pa.commune is null or l.commune ilike ('%' || pa.commune || '%'))
          and (pa.kind is null or l.kind::text = pa.kind) -- ✅ FIX
          and (pa.property_type is null or l."propertyType"::text = pa.property_type) -- ✅ FIX
          and (pa.bedrooms_min is null or l.bedrooms >= pa.bedrooms_min)
          and (pa.min_price is null or l.price >= pa.min_price)
          and (pa.max_price is null or l.price <= pa.max_price)
          and (pa.min_size is null or l."sizeSqm" >= pa.min_size)
          and (pa.max_size is null or l."sizeSqm" <= pa.max_size)
          and (pa.badge is null or p.badge::text = pa.badge) -- ✅ FIX
      )
      select "listingId"
      from filtered
      order by
        boost_active desc,
        boost_level_rank desc,
        score7d desc,
        saves7d desc,
        updatedAt desc
      limit ${take} offset ${offset};
    `;

    const ids = rows.map((r) => r.listingId);
    if (!ids.length) {
      return NextResponse.json({
        items: [],
        nextCursor: { offset: offset + take },
        hasMore: false,
        meta: { mode: "db_boosted" },
      });
    }

    const listings = await prisma.listing.findMany({
      where: { id: { in: ids }, isPublished: true, status: "ACTIVE" },
      include: includePublic,
    });

    const byId = new Map(listings.map((l: any) => [l.id, l]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    const items = await attachUserFlags(ordered);

    return NextResponse.json({
      items,
      nextCursor: { offset: offset + take },
      hasMore: items.length === take,
      meta: { mode: "db_boosted" },
    });
  }

  // Other sorts: normal Prisma ordering
  const rawItems = await prisma.listing.findMany({
    where,
    orderBy: getOrderBy(sort),
    skip: offset,
    take,
    include: includePublic,
  });

  const items = await attachUserFlags(rawItems);

  return NextResponse.json({
    items,
    nextCursor: { offset: offset + take },
    hasMore: items.length === take,
    meta: { mode: "db" },
  });
}