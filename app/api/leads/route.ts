// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend, LEADS_FROM, LEADS_NOTIFY } from "@/lib/email/resend";
import { newLeadEmailHtml } from "@/lib/email/templates/newLead";
import { upsertBuyerProfileFromLead } from "@/lib/ai/buyerProfile/upsertBuyerProfileFromLead";
import { runLeadMatch } from "@/lib/matching/runLeadMatch";
import { requireAgencyContext } from "@/lib/auth-server";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "VIEWING" | "OFFER" | "WON" | "LOST";

const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "OFFER",
  "WON",
  "LOST",
];

function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && LEAD_STATUSES.includes(v as LeadStatus);
}

/**
 * PUBLIC: Create a new lead from the public listing page form.
 * - Multi-tenant scoping is derived from listing.agencyId.
 * - Does NOT require auth.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const listingId = String(body.listingId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!listingId) {
      return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
    }

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: "Please write a short message (min 10 characters)" },
        { status: 400 }
      );
    }

    // 1️⃣ Ensure listing exists (and get agencyId for scoping)
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        agencyId: true,
        title: true,
        commune: true,
        price: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const agencyId = listing.agencyId ?? null;

    // 2️⃣ Create lead in DB
    const lead = await prisma.lead.create({
      data: {
        listingId,
        agencyId,
        name,
        email,
        phone: phone || null,
        message,
        status: "NEW",
      },
      select: { id: true },
    });

    // 3️⃣ Send email (best-effort)
    let emailSent = false;
    let emailError: string | null = null;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

      const result = await resend.emails.send({
        from: LEADS_FROM,
        to: LEADS_NOTIFY,
        subject: `New lead: ${listing.title} (${listing.commune})`,
        html: newLeadEmailHtml({
          listingTitle: listing.title,
          listingCommune: listing.commune,
          listingPrice: listing.price,
          listingUrl: `${baseUrl}/listing/${listing.id}`,
          leadName: name,
          leadEmail: email,
          leadPhone: phone || null,
          leadMessage: message,
        }),
      });

      console.log("RESEND_RESULT:", result);

      // @ts-ignore
      if (result?.error) {
        // @ts-ignore
        emailError = String(result.error?.message ?? result.error);
      } else {
        emailSent = true;
      }
    } catch (err: any) {
      console.error("RESEND_ERROR:", err);
      emailError = String(err?.message ?? err);
    }

    // 4️⃣ Best-effort buyer profiling + matching
    // BuyerProfile requires agencyId; if null, skip.
    if (agencyId) {
      try {
        await upsertBuyerProfileFromLead({ leadId: lead.id });
        await runLeadMatch({ leadId: lead.id, topK: 10 });
      } catch (e) {
        console.error("buyer profiling/matching failed:", e);
      }
    }

    return NextResponse.json({ ok: true, id: lead.id, emailSent, emailError }, { status: 201 });
  } catch (e) {
    console.error("Lead create error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * INTERNAL (AUTH REQUIRED): Update lead status (and optionally listingId).
 * This is used by the agency UI for inline status changes / workflow.
 *
 * Endpoint: PATCH /api/leads
 * Body: { id: string; status: LeadStatus; listingId?: string | null }
 *
 * Security:
 * - Requires agency context.
 * - Only updates leads that belong to that agency (lead.agencyId === agency.id).
 */
export async function PATCH(req: Request) {
  try {
    const { agency } = await requireAgencyContext();

    const body = (await req.json().catch(() => null)) as
      | { id?: unknown; status?: unknown; listingId?: unknown }
      | null;

    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const nextStatus = body?.status;

    // listingId can be set to string, null, or omitted
    const listingIdRaw = body?.listingId;
    const listingId =
      typeof listingIdRaw === "string"
        ? listingIdRaw.trim() || null
        : listingIdRaw === null
        ? null
        : undefined;

    if (!id) {
      return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
    }
    if (!isLeadStatus(nextStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Expected one of: ${LEAD_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Ensure lead belongs to agency (multi-tenant boundary)
    const existing = await prisma.lead.findFirst({
      where: { id, agencyId: agency.id },
      select: { id: true, agencyId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // If listingId is being changed, ensure it belongs to the same agency
    if (typeof listingId !== "undefined" && listingId !== null) {
      const listing = await prisma.listing.findFirst({
        where: { id: listingId, agencyId: agency.id },
        select: { id: true },
      });

      if (!listing) {
        return NextResponse.json(
          { error: "Listing not found (or not in your agency)" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(typeof listingId !== "undefined" ? { listingId } : {}),
      },
      select: {
        id: true,
        status: true,
        listingId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, lead: updated }, { status: 200 });
  } catch (e: any) {
    console.error("Lead update error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
