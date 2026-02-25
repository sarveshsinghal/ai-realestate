import { prisma } from "@/lib/prisma";
import { indexListing } from "@/lib/search/indexListing";

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true },
    take: 5000,
  });

  for (const l of listings) {
    await indexListing(l.id);
    console.log("indexed", l.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
