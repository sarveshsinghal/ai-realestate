// app/api/leads/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend, LEADS_FROM, LEADS_NOTIFY } from "@/lib/email/resend";
import { newLeadEmailHtml } from "@/lib/email/templates/newLead";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
      return NextResponse.json(
        { error: "Please enter your name" },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email" },
        { status: 400 }
      );
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

    // If a listing somehow has no agencyId, we still allow lead creation,
    // but the lead will not show up in any agency inbox until fixed.
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

    // 3️⃣ Send email (non-blocking)
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

    return NextResponse.json(
      { ok: true, id: lead.id, emailSent, emailError },
      { status: 201 }
    );
  } catch (e) {
    console.error("Lead create error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
