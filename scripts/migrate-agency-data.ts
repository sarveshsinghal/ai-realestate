import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const sourceAgencyId = process.env.SOURCE_AGENCY_ID?.trim();
  const targetAgencyId = process.env.TARGET_AGENCY_ID?.trim();

  if (!sourceAgencyId || !targetAgencyId) {
    throw new Error(
      "Set SOURCE_AGENCY_ID and TARGET_AGENCY_ID. Example:\n" +
        'SOURCE_AGENCY_ID="old" TARGET_AGENCY_ID="new" npx tsx scripts/migrate-agency-data.ts'
    );
  }

  if (sourceAgencyId === targetAgencyId) {
    throw new Error("SOURCE_AGENCY_ID and TARGET_AGENCY_ID are the same.");
  }

  const [sourceAgency, targetAgency] = await Promise.all([
    prisma.agency.findUnique({ where: { id: sourceAgencyId } }),
    prisma.agency.findUnique({ where: { id: targetAgencyId } }),
  ]);

  if (!sourceAgency) throw new Error(`Source agency not found: ${sourceAgencyId}`);
  if (!targetAgency) throw new Error(`Target agency not found: ${targetAgencyId}`);

  console.log("🔁 Migrating data:");
  console.log(`   FROM: ${sourceAgency.name} (${sourceAgencyId})`);
  console.log(`   TO:   ${targetAgency.name} (${targetAgencyId})`);

  const [sourceListingsCount, sourceLeadsCount, sourceMembersCount] =
    await Promise.all([
      prisma.listing.count({ where: { agencyId: sourceAgencyId } }),
      prisma.lead.count({ where: { agencyId: sourceAgencyId } }),
      prisma.agencyMember.count({ where: { agencyId: sourceAgencyId } }),
    ]);

  console.log("\n📊 Source counts:");
  console.log("   listings:", sourceListingsCount);
  console.log("   leads:", sourceLeadsCount);
  console.log("   members:", sourceMembersCount);

  // Move listings first (so new leads will also align going forward)
  const updatedListings = await prisma.listing.updateMany({
    where: { agencyId: sourceAgencyId },
    data: { agencyId: targetAgencyId },
  });

  // Move leads
  const updatedLeads = await prisma.lead.updateMany({
    where: { agencyId: sourceAgencyId },
    data: { agencyId: targetAgencyId },
  });

  // Move memberships (optional but helpful if old agency had members)
  // Avoid duplicates: if a user already has membership in target agency, skip those.
  const oldMembers = await prisma.agencyMember.findMany({
    where: { agencyId: sourceAgencyId },
    select: { id: true, userId: true, supabaseUserId: true },
  });

  let movedMembers = 0;
  for (const m of oldMembers) {
    const existsInTarget = await prisma.agencyMember.findFirst({
      where: {
        agencyId: targetAgencyId,
        OR: [{ userId: m.userId }, { supabaseUserId: m.supabaseUserId }],
      },
      select: { id: true },
    });

    if (existsInTarget) continue;

    await prisma.agencyMember.update({
      where: { id: m.id },
      data: { agencyId: targetAgencyId },
    });

    movedMembers++;
  }

  console.log("\n✅ Done:");
  console.log("   listings moved:", updatedListings.count);
  console.log("   leads moved:", updatedLeads.count);
  console.log("   members moved:", movedMembers);

  console.log("\nℹ️ Next:");
  console.log("   Re-run verify script to confirm ✅ MATCH.");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
