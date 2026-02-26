import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserContext } from "@/lib/requireUserContext";

export async function GET() {
  try {
    const { userId } = await requireUserContext();

    const count = await prisma.wishlistItem.count({
      where: { userId },
    });

    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}