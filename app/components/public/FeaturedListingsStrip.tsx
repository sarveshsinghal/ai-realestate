// app/components/public/FeaturedListingsStrip.tsx
import ListingCard from "@/app/components/ListingCard";
import { prisma } from "@/lib/prisma";

export default async function FeaturedListingsStrip() {
  const items: any[] = await prisma.listing.findMany({
    where: { isPublished: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 6,
    include: {
      media: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true, sortOrder: true },
      },
    },
  });

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((listing) => (
        <ListingCard key={listing.id} listing={listing} href={`/listing/${listing.id}`} />
      ))}
    </div>
  );
}