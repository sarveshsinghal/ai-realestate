import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserContext } from "@/lib/requireUserContext";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = params.id;
    const ctx = await getUserContext();

    // optional session marker (not required)
    const sessionId = req.headers.get("x-session-id") ?? null;

    await prisma.listingViewEvent.create({
      data: {
        id: crypto.randomUUID(),
        listingId,
        userId: ctx?.userId ?? null,
        sessionId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}