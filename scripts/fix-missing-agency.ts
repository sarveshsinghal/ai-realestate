import "dotenv/config";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

import { prisma } from "@/lib/prisma";

const MISSING_AGENCY_ID = "cmloqb050000ztj8byc4ttn7";
const AGENCY_NAME = "Seeded Agency";
const AGENCY_SLUG = "seeded-agency";

async function main() {
  const existing = await prisma.agency.findUnique({
    where: { id: MISSING_AGENCY_ID },
    select: { id: true },
  });

  if (existing) {
    console.log("Agency already exists:", existing.id);
    return;
  }

  // Ensure slug is unique
  let slug = AGENCY_SLUG;
  for (let i = 0; i < 50; i++) {
    const taken = await prisma.agency.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) break;
    slug = `${AGENCY_SLUG}-${i + 1}`;
  }

  await prisma.agency.create({
    data: {
      id: MISSING_AGENCY_ID, // ✅ create with the referenced id
      name: AGENCY_NAME,
      slug,
    },
  });

  console.log(`✅ Created missing Agency: ${AGENCY_NAME} (${MISSING_AGENCY_ID}) slug=${slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
