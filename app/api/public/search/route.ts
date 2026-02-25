// app/api/public/search/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embedText } from "@/lib/search/embeddings";

export const runtime = "nodejs";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: Request) {
  const body = await req.json();
  const query = String(body?.query ?? "").trim();
  if (query.length < 2) return NextResponse.json({ results: [], meta: { mode: "empty_query" } });

  const limit = clamp(Number(body?.paging?.limit ?? 5), 1, 10);
  const offset = clamp(Number(body?.paging?.offset ?? 0), 0, 500);

  const minPrice = body?.filters?.minPrice ?? null;
  const maxPrice = body?.filters?.maxPrice ?? null;
  const bedroomsMin = body?.filters?.bedroomsMin ?? null;
  const communes = Array.isArray(body?.filters?.communes) ? body.filters.communes.slice(0, 20) : null;
  const propertyTypes = Array.isArray(body?.filters?.propertyTypes) ? body.filters.propertyTypes.slice(0, 20) : null;

  // 1) Try hybrid index search
  try {
    let qv: number[] | null = null;
    try {
      qv = (await embedText(query)).vector;
    } catch {
      qv = null;
    }

    const rows = await prisma.$queryRaw<
      Array<{
        listingId: string;
        score: number;
        commune: string | null;
        price: number | null;
        bedrooms: number | null;
        propertyType: string | null;
      }>
    >`
      with params as (
        select
          ${query}::text as q,
          ${qv ? (qv as any) : null}::vector(1536) as qv,
          ${minPrice}::int as min_price,
          ${maxPrice}::int as max_price,
          ${bedroomsMin}::int as bedrooms_min,
          ${communes ?? null}::text[] as communes,
          ${propertyTypes ?? null}::text[] as property_types
      ),
      base as (
        select si.*
        from "ListingSearchIndex" si, params p
        where si.status = 'PUBLISHED'
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
        limit 200
      ),
      vec as (
        select
          b."listingId",
          (b.embedding <-> (select qv from params)) as vec_dist
        from base b
        where (select qv from params) is not null
          and b.embedding is not null
        order by vec_dist asc
        limit 200
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
        )::float8 as score,
        b.commune,
        b.price,
        b.bedrooms,
        b."propertyType"
      from candidates c
      join base b on b."listingId" = c."listingId"
      order by score desc
      limit ${limit} offset ${offset};
    `;

    // If index returns rows, use them
    if (rows.length) {
      return NextResponse.json({
        results: rows,
        meta: { mode: "hybrid", usedEmbeddings: Boolean(qv), limit, offset },
      });
    }

    // If empty rows, fall through to fallback
  } catch (e) {
    console.error("[public/search] hybrid failed, falling back to prisma:", e);
  }

  // 2) Fallback: search directly in Listing table
  const fallback = await prisma.listing.findMany({
    where: {
      isPublished: true,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { commune: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    skip: offset,
    select: {
      id: true,
      commune: true,
      price: true,
      bedrooms: true,
      propertyType: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const results = fallback.map((l) => ({
    listingId: l.id,
    score: 0.25, // low but non-zero; dropdown just needs something useful
    commune: l.commune ?? null,
    price: l.price ?? null,
    bedrooms: l.bedrooms ?? null,
    propertyType: (l.propertyType as any) ?? null,
  }));

  return NextResponse.json({
    results,
    meta: { mode: "prisma_fallback", limit, offset },
  });
}