import "dotenv/config";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

import { prisma } from "@/lib/prisma";

// ✅ Put the agencyId you see in Prisma Studio (Lead.agencyId)
const TARGET_AGENCY_ID = "cmloqb050000ztj8byc4ttn7";

// ✅ Put your email you used to login (same as shown in Prisma Studio Lead.email column or Google login)
const MY_EMAIL = "sarvesh.singhal2000@gmail.com";

async function main() {
  if (!TARGET_AGENCY_ID) throw new Error("Set TARGET_AGENCY_ID");
  if (!MY_EMAIL) throw new Error("Set MY_EMAIL");

  const agency = await prisma.agency.findUnique({
    where: { id: TARGET_AGENCY_ID },
    select: { id: true, name: true },
  });
  if (!agency) throw new Error(`Agency not found: ${TARGET_AGENCY_ID}`);

  // Find your internal user created at login
  const user = await prisma.user.findFirst({
    where: { email: MY_EMAIL },
    select: { id: true, email: true, supabaseUserId: true },
  });

  if (!user) {
    throw new Error(
      `User not found in DB for email=${MY_EMAIL}. Login once so User gets created, then retry.`
    );
  }

  // Update or create membership
  const existing = await prisma.agencyMember.findFirst({
    where: { supabaseUserId: user.supabaseUserId },
    select: { id: true, agencyId: true },
  });

  if (existing) {
    await prisma.agencyMember.update({
      where: { id: existing.id },
      data: {
        agencyId: agency.id,
        userId: user.id,
        email: user.email ?? "",
      },
    });
    console.log(
      `✅ Updated membership -> agency ${agency.name} (${agency.id})`
    );
  } else {
    await prisma.agencyMember.create({
      data: {
        agencyId: agency.id,
        userId: user.id,
        supabaseUserId: user.supabaseUserId,
        email: user.email ?? "",
        role: "ADMIN",
      },
    });
    console.log(
      `✅ Created membership -> agency ${agency.name} (${agency.id})`
    );
  }

  console.log(`User: ${user.email} | supabaseUserId: ${user.supabaseUserId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
