require("dotenv").config({ path: ".env" }); // change to ".env.local" if your URL is there

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const LISTINGS = require("./mockListings.json");

// Debug: verify env is loaded + looks correct (prints host only)
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing. Put it in .env (or change dotenv path).");
  process.exit(1);
}
try {
  const u = new URL(process.env.DATABASE_URL);
  console.log("DB host:", u.host);
} catch (e) {
  console.error("❌ DATABASE_URL is not a valid URL. Check quotes/spaces/newlines.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


const conditionMap = {
  New: "NEW",
  Renovated: "RENOVATED",
  Good: "GOOD",
  "To renovate": "TO_RENOVATE",
};

async function main() {
  console.log("Seeding database...");

  const agency = await prisma.agency.upsert({
    where: { slug: "marketplace" },
    update: {},
    create: { name: "Marketplace", slug: "marketplace" },
  });

  let upserted = 0;

  for (const l of LISTINGS) {
    const listing = await prisma.listing.upsert({
      where: { id: l.id },
      update: {
        title: l.title,
        commune: l.commune,
        addressHint: l.addressHint ?? null,
        price: l.price,
        sizeSqm: l.sizeSqm,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        condition: conditionMap[l.condition] ?? "GOOD",
        energyClass: l.energyClass,
        agencyId: agency.id,
        isPublished: true,
      },
      create: {
        id: l.id,
        title: l.title,
        commune: l.commune,
        addressHint: l.addressHint ?? null,
        price: l.price,
        sizeSqm: l.sizeSqm,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        condition: conditionMap[l.condition] ?? "GOOD",
        energyClass: l.energyClass,
        agencyId: agency.id,
        isPublished: true,
      },
    });

    // Avoid duplicates if re-run
    await prisma.listingMedia.deleteMany({ where: { listingId: listing.id } });

    for (let i = 0; i < (l.images?.length ?? 0); i++) {
      await prisma.listingMedia.create({
        data: { listingId: listing.id, url: l.images[i], sortOrder: i },
      });
    }

    upserted++;
  }

  console.log(`✅ Seeding complete. Upserted ${upserted} listings.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
