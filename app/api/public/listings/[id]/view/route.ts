import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserContext } from "@/lib/requireUserContext";

export const runtime = "nodejs";

function getSessionId(req: Request) {
  // Best-effort session id from cookie (optional). If you don't have one, it's fine.
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)eid=([^;]+)/); // example cookie name
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // Optional: ignore invalid ids quickly
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  const user = await getUserContext();
  const userId = user?.userId ?? null;

  await prisma.listingViewEvent.create({
    data: {
      listingId: id,
      userId,
      sessionId: null, // keep null unless you add a real session id
    },
  });

  return NextResponse.json({ ok: true });
}