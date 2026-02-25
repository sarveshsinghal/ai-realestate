// scripts/verify-agency-wiring.ts
import "dotenv/config";

// Force scripts to use a known-good URL (same one your app uses)
process.env.DATABASE_URL =
  process.env.DATABASE_URL_SCRIPTS ||
  process.env.DATABASE_URL_DIRECT ||
  process.env.DATABASE_URL;

import { prisma } from "@/lib/prisma";

async function main() {
  const email = process.env.MY_LOGIN_EMAIL;

  if (!email) {
    throw new Error(
      "Set MY_LOGIN_EMAIL in .env.local (e.g. MY_LOGIN_EMAIL=you@gmail.com)"
    );
  }

  console.log("🔎 Checking agency wiring for:", email);

  // 1️⃣ Find user
  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    console.log("❌ No User row found.");
    return;
  }

  console.log("✅ User found:");
  console.log("   id:", user.id);
  console.log("   supabaseUserId:", user.supabaseUserId);

  // 2️⃣ Find membership
  const membership = await prisma.agencyMember.findFirst({
    where: { supabaseUserId: user.supabaseUserId },
    include: { agency: true },
  });

  if (!membership) {
    console.log("❌ No AgencyMember row found.");
    return;
  }

  console.log("✅ Membership found:");
  console.log("   agencyId:", membership.agencyId);
  console.log("   agencyName:", membership.agency.name);
  console.log("   role:", membership.role);

  // 3️⃣ Check recent leads
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      agencyId: true,
      email: true,
      createdAt: true,
    },
  });

  console.log("\n📨 Last 5 Leads in DB:");
  if (leads.length === 0) {
    console.log("   (No leads found)");
  }

  for (const lead of leads) {
    const match = lead.agencyId === membership.agencyId ? "✅ MATCH" : "❌ MISMATCH";

    console.log(
      `   ${lead.id} | agencyId=${lead.agencyId} | ${lead.email} | ${match}`
    );
  }

  console.log("\n🎯 Expected:");
  console.log("   All leads belonging to your agency should show ✅ MATCH");
}

main()
  .catch((e) => {
    console.error("❌ Script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
