// scripts/backfill-listings-agency.ts
import "dotenv/config";

// Force scripts to use a direct SSL URL if provided (recommended for scripts)
process.env.DATABASE_URL =
  process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

import { prisma } from "@/lib/prisma";

/**
 * Minimal slugify for Agency.slug
 */
function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Create or find an Agency by name.
 * - First tries exact name match
 * - Otherwise creates new with unique slug
 */
async function ensureAgencyForName(nameRaw: string) {
  const name = String(nameRaw ?? "").trim();
  if (!name) return null;

  // Try exact name match first
  const existingByName = await prisma.agency.findFirst({
    where: { name },
    select: { id: true, slug: true, name: true },
  });
  if (existingByName) return existingByName;

  // Create a unique slug
  const baseSlug = slugify(name) || `agency-${Date.now()}`;
  let slug = baseSlug;

  for (let i = 0; i < 50; i++) {
    const taken = await prisma.agency.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) break;
    slug = `${baseSlug}-${i + 1}`;
  }

  // Create agency
  return prisma.agency.create({
    data: { name, slug },
    select: { id: true, slug: true, name: true },
  });
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: {
      agencyId: null,
      NOT: { agencyName: null },
    },
    select: { id: true, agencyName: true },
    take: 5000,
  });

  let updated = 0;
  let skipped = 0;

  for (const l of listings) {
    const agencyName = (l.agencyName ?? "").trim();
    if (!agencyName) {
      skipped++;
      continue;
    }

    const agency = await ensureAgencyForName(agencyName);
    if (!agency) {
      skipped++;
      continue;
    }

    await prisma.listing.update({
      where: { id: l.id },
      data: { agencyId: agency.id },
    });

    updated++;
  }

  console.log(
    `Backfill complete. Updated ${updated}/${listings.length} listings. Skipped ${skipped}.`
  );
}

main()
  .catch((e) => {
    console.error("Backfill error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
