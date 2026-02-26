import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserContext } from "@/lib/requireUserContext";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ listingId: string }> }
) {
  try {
    const { userId } = await requireUserContext();
    const { listingId } = await ctx.params;

    await prisma.wishlistItem.deleteMany({
      where: { userId, listingId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}