// lib/ai/buyerProfile/upsertBuyerProfileFromLead.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractBuyerProfile } from "./extractBuyerProfile";
import { embedText } from "@/lib/search/embeddings";

function normalize(input: string) {
  return input.replace(/\s+/g, " ").trim().slice(0, 12000);
}

function ensure1536(vec: unknown): number[] {
  if (!Array.isArray(vec)) throw new Error("Embedding is not an array");
  const nums = vec.map((x) => (typeof x === "number" ? x : Number(x)));
  if (nums.length !== 1536) throw new Error(`Expected 1536 dims, got ${nums.length}`);
  if (nums.some((n) => !Number.isFinite(n))) throw new Error("Embedding contains non-finite numbers");
  return nums;
}

export async function upsertBuyerProfileFromLead(params: { leadId: string }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: {
      id: true,
      agencyId: true,
      message: true,
      listing: {
        select: { title: true, commune: true, price: true, kind: true, propertyType: true },
      },
    },
  });

  if (!lead) throw new Error("Lead not found");
  if (!lead.agencyId) throw new Error("Lead has no agencyId (cannot scope BuyerProfile)");

  const msg = (lead.message ?? "").trim();
  if (!msg) throw new Error("Lead has no message");

  let extracted: any = null;
  let extractionError: string | null = null;

  try {
    extracted = await extractBuyerProfile({
      leadMessage: msg,
      listingContext: lead.listing
        ? {
            title: lead.listing.title,
            commune: lead.listing.commune,
            price: lead.listing.price,
            kind: lead.listing.kind,
            propertyType: lead.listing.propertyType,
          }
        : undefined,
    });
  } catch (e: any) {
    extractionError = String(e?.message ?? e);
    extracted = {
      kind: null,
      propertyType: null,
      budgetMin: null,
      budgetMax: null,
      sizeMinSqm: null,
      sizeMaxSqm: null,
      bedroomsMin: null,
      bedroomsMax: null,
      bathroomsMin: null,
      communes: [],
      furnished: null,
      petsAllowed: null,
      hasElevator: null,
      hasBalcony: null,
      hasTerrace: null,
      hasGarden: null,
      hasCellar: null,
      parkingMin: null,
      queryText: msg.slice(0, 500),
    };
  }

  const queryText = normalize(String(extracted?.queryText ?? msg));

  const buyerProfile = await prisma.buyerProfile.upsert({
    where: { leadId: lead.id },
    create: {
      agencyId: lead.agencyId,
      leadId: lead.id,
      source: extractionError ? "MIXED" : "LEAD_MESSAGE",

      kind: extracted.kind,
      propertyType: extracted.propertyType,
      budgetMin: extracted.budgetMin,
      budgetMax: extracted.budgetMax,
      sizeMinSqm: extracted.sizeMinSqm,
      sizeMaxSqm: extracted.sizeMaxSqm,
      bedroomsMin: extracted.bedroomsMin,
      bedroomsMax: extracted.bedroomsMax,
      bathroomsMin: extracted.bathroomsMin,
      communes: extracted.communes ?? [],

      furnished: extracted.furnished,
      petsAllowed: extracted.petsAllowed,
      hasElevator: extracted.hasElevator,
      hasBalcony: extracted.hasBalcony,
      hasTerrace: extracted.hasTerrace,
      hasGarden: extracted.hasGarden,
      hasCellar: extracted.hasCellar,
      parkingMin: extracted.parkingMin,

      queryText,
    },
    update: {
      source: extractionError ? "MIXED" : "LEAD_MESSAGE",

      kind: extracted.kind,
      propertyType: extracted.propertyType,
      budgetMin: extracted.budgetMin,
      budgetMax: extracted.budgetMax,
      sizeMinSqm: extracted.sizeMinSqm,
      sizeMaxSqm: extracted.sizeMaxSqm,
      bedroomsMin: extracted.bedroomsMin,
      bedroomsMax: extracted.bedroomsMax,
      bathroomsMin: extracted.bathroomsMin,
      communes: extracted.communes ?? [],

      furnished: extracted.furnished,
      petsAllowed: extracted.petsAllowed,
      hasElevator: extracted.hasElevator,
      hasBalcony: extracted.hasBalcony,
      hasTerrace: extracted.hasTerrace,
      hasGarden: extracted.hasGarden,
      hasCellar: extracted.hasCellar,
      parkingMin: extracted.parkingMin,

      queryText,
    },
    select: { id: true },
  });

  await prisma.buyerProfileVersion.create({
    data: {
      buyerProfileId: buyerProfile.id,
      model: extractionError ? "fallback" : "gpt-4o-mini",
      promptVersion: "bp_v1",
      sourceText: msg,
      extractedJson: extracted,
      notes: extractionError ? `AI extraction failed: ${extractionError}` : null,
    },
    select: { id: true },
  });

  // ✅ Best-effort embed and write BuyerProfile.embedding (pgvector)
  try {
    const emb = await embedText(queryText);
    const vec = ensure1536(emb.vector);

    // IMPORTANT: pass as Postgres numeric[] and build vector safely
    await prisma.$executeRaw(
      Prisma.sql`
        update "BuyerProfile"
        set embedding = (
          '[' || array_to_string(${vec}::float8[], ',') || ']'
        )::vector(1536)
        where id = ${buyerProfile.id};
      `
    );
  } catch (e) {
    console.error("BuyerProfile embedding failed; leaving embedding null", e);
  }

  return { buyerProfileId: buyerProfile.id, extracted, extractionError };
}
