export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import { MemberRole } from "@prisma/client";
import { indexListing } from "@/lib/search/indexListing";

type Body = {
  mode?: "rows" | "full"; // rows = ensure rows + status/searchText; full = also embeddings for published
  limit?: number;         // default 200
  cursor?: string;        // listingId cursor for pagination
};

function canReindex(role: MemberRole) {
  return role === MemberRole.ADMIN || role === MemberRole.MANAGER;
}

export async function POST(req: Request) {
  try {
    const { membership, agency } = await requireAgencyContext();
    if (!canReindex(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const mode: Body["mode"] = body.mode ?? "rows";
    const limit = Math.min(Math.max(Number(body.limit ?? 200), 1), 500);
    const cursor = typeof body.cursor === "string" && body.cursor.trim() ? body.cursor.trim() : null;

    // page through listings for this agency
    const listings = await prisma.listing.findMany({
      where: {
        agencyId: agency.id,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: limit,
      select: { id: true, isPublished: true, agencyId: true },
    });

    let ok = 0;
    let failed = 0;

    // Sequential on purpose (avoid rate limits + keep DB stable)
    for (const l of listings) {
      try {
        // indexListing already:
        // - builds searchText
        // - upserts row
        // - nulls embedding for drafts
        // - writes embedding for published (best-effort) using embedText
        //
        // For "rows" mode, we temporarily force no-embedding by indexing but leaving drafts behavior intact.
        // Easiest: still call indexListing, but if mode==="rows" we won’t generate embeddings by making it act like draft.
        // However indexListing decides by isPublished in DB, so for rows-only we do a minimal upsert here instead.
        if (mode === "rows") {
          // minimal guaranteed row with correct status (no embedding)
          await prisma.listingSearchIndex.upsert({
            where: { listingId: l.id },
            create: {
              listingId: l.id,
              agencyId: agency.id,
              status: l.isPublished ? "PUBLISHED" : "DRAFT",
              searchText: "", // will be filled by indexListing later if you choose
              updatedAt: new Date(),
            },
            update: {
              agencyId: agency.id,
              status: l.isPublished ? "PUBLISHED" : "DRAFT",
              updatedAt: new Date(),
            },
          });
        } else {
          // full indexing (searchText + optional embedding)
          await indexListing(l.id);
        }

        ok++;
      } catch (e) {
        failed++;
        console.error("reindex failed for listing", l.id, e);
      }
    }

    const nextCursor = listings.length > 0 ? listings[listings.length - 1].id : null;
    const hasMore = listings.length === limit;

    return NextResponse.json({
      ok: true,
      agencyId: agency.id,
      mode,
      processed: listings.length,
      succeeded: ok,
      failed,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (e) {
    console.error("Reindex endpoint error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
