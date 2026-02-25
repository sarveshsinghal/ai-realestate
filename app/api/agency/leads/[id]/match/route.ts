// app/api/agency/leads/[id]/match/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runLeadMatch } from "@/lib/matching/runLeadMatch";
import { requireAgencyContext } from "@/lib/requireAgencyContext";

export const runtime = "nodejs";

function canRunMatch(role: string | null | undefined) {
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT";
}

function clampInt(
  n: unknown,
  { min, max, fallback }: { min: number; max: number; fallback: number }
) {
  const x = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await ctx.params;

  // ✅ your helper takes 0 args
  const agencyCtx = await requireAgencyContext();

  // ✅ role is on membership in your ctx type
  const role = agencyCtx.membership?.role;

  if (!canRunMatch(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, agencyId: true },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // ✅ agency id is on agency object in your ctx type
  const ctxAgencyId = agencyCtx.agency?.id;

  if (!lead.agencyId || !ctxAgencyId || lead.agencyId !== ctxAgencyId) {
    return NextResponse.json(
      {
        error: "Forbidden",
        debug: {
          leadAgencyId: lead.agencyId ?? null,
          ctxAgencyId: ctxAgencyId ?? null,
          role: role ?? null,
        },
      },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { topK?: number };
  const topK = clampInt(body.topK, { min: 1, max: 50, fallback: 10 });

  const result = await runLeadMatch({ leadId, topK });

  return NextResponse.json({
    ok: true,
    leadId,
    agencyId: ctxAgencyId,
    topK,
    result,
  });
}
