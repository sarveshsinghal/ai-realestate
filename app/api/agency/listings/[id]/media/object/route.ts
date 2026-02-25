// app/api/agency/listings/[id]/media/object/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { LISTING_MEDIA_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

type PostBody = {
  // listingId optional because URL param [id] is primary
  listingId?: string;
  filename: string;
  contentType?: string;
};

type DeleteBody = {
  listingId?: string;
  path: string; // "listings/{agencyId}/{listingId}/{uuid}.{ext}"
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function extFromFilename(filename: string): string | null {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return null;
  const ext = filename.slice(lastDot + 1).trim().toLowerCase();
  if (!ext) return null;
  if (!/^[a-z0-9]+$/.test(ext)) return null;
  return ext;
}

function safeBaseName(filename: string): string {
  const justName = filename.split("/").pop()?.split("\\").pop() ?? "file";
  return justName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
}

async function getParamListingId(ctx: { params: Promise<{ id: string }> } | undefined) {
  try {
    if (!ctx?.params) return null;
    const p = await ctx.params;
    return typeof p?.id === "string" ? p.id : null;
  } catch {
    return null;
  }
}

function getListingIdFromBody(body: any): string | null {
  return typeof body?.listingId === "string" ? body.listingId : null;
}

/**
 * POST: Create signed upload URL
 * Body: { filename, contentType?, listingId? }
 * Primary listingId is URL param [id].
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agency } = await requireAgencyContext();
    const body = (await req.json().catch(() => null)) as PostBody | null;

    if (!body || typeof body.filename !== "string" || body.filename.trim().length === 0) {
      return jsonError("filename is required", 400);
    }

    const listingIdFromParam = await getParamListingId(ctx);
    const listingId = listingIdFromParam ?? getListingIdFromBody(body);

    if (!listingId) {
      return jsonError("listingId is required (URL param [id] or body.listingId)", 400);
    }

    // Ownership check
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, agencyId: agency.id },
      select: { id: true },
    });

    if (!listing) return jsonError("Listing not found", 404);

    // Build path: listings/{agencyId}/{listingId}/{uuid}.{ext}
    const cleanName = safeBaseName(body.filename);
    const ext = extFromFilename(cleanName) ?? "bin";
    const uuid = crypto.randomUUID();
    const path = `listings/${agency.id}/${listingId}/${uuid}.${ext}`;

    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(LISTING_MEDIA_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      console.error("createSignedUploadUrl error:", error);
      return jsonError("Failed to create signed upload URL", 500);
    }

    return NextResponse.json({
      bucket: LISTING_MEDIA_BUCKET,
      path,
      signedUrl: data.signedUrl,
      token: (data as any).token ?? null,
      contentType: body.contentType ?? null,
      originalFilename: cleanName,
    });
  } catch (e) {
    console.error("POST media/object error:", e);
    return jsonError("Server error", 500);
  }
}

/**
 * DELETE: Delete object from Storage + delete DB ListingMedia rows
 * Body: { path, listingId? }
 *
 * Verifies:
 * - listing belongs to agency
 * - path is within listings/{agencyId}/{listingId}/...
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agency } = await requireAgencyContext();
    const body = (await req.json().catch(() => null)) as DeleteBody | null;

    if (!body || typeof body.path !== "string" || body.path.trim().length === 0) {
      return jsonError("path is required", 400);
    }

    const listingIdFromParam = await getParamListingId(ctx);
    const listingId = listingIdFromParam ?? getListingIdFromBody(body);

    if (!listingId) {
      return jsonError("listingId is required (URL param [id] or body.listingId)", 400);
    }

    // Ownership check
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, agencyId: agency.id },
      select: { id: true },
    });

    if (!listing) return jsonError("Listing not found", 404);

    // Path scope check
    const expectedPrefix = `listings/${agency.id}/${listingId}/`;
    if (!body.path.startsWith(expectedPrefix)) {
      return jsonError("Forbidden: path does not belong to this listing", 403);
    }

    // 1) Delete from storage
    const supabase = createSupabaseAdmin();
    const { error: removeError } = await supabase.storage
      .from(LISTING_MEDIA_BUCKET)
      .remove([body.path]);

    if (removeError) {
      console.error("storage.remove error:", removeError);
      return jsonError("Failed to delete object from storage", 500);
    }

    // 2) Delete DB media record(s)
    // Your DB stores `url`, not `path`.
    // We delete rows for this listing where url contains the path.
    // This works for both public URLs and signed URLs that embed the path.
    try {
      await prisma.listingMedia.deleteMany({
        where: {
          listingId,
          url: { contains: body.path },
        },
      });
    } catch (e) {
      // Storage deletion succeeded; DB cleanup failing shouldn't block the response
      console.error("DB ListingMedia cleanup failed (non-fatal):", e);
    }

    return NextResponse.json({ ok: true, deleted: body.path });
  } catch (e) {
    console.error("DELETE media/object error:", e);
    return jsonError("Server error", 500);
  }
}
