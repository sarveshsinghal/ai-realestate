// app/agency/listings/[id]/edit/page.tsx
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";
import ListingEditor from "@/app/agency/listings/_components/ListingEditor";

export default async function EditListingPage(props: { params: Promise<{ id: string }> }) {
  const { agency } = await requireAgencyContext();
  const { id } = await props.params;

  const listing = await prisma.listing.findFirst({
    where: { id, agencyId: agency.id },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      priceHistory: { orderBy: { recordedAt: "desc" }, take: 20 },
    },
  });

  if (!listing) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Listing not found</h1>
        <p className="mt-2 text-sm text-gray-600">This listing does not exist or you don’t have access.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Edit listing</h1>
      <p className="mt-1 text-sm text-gray-600">Manage details, images, and pricing history.</p>

      <div className="mt-6">
        <ListingEditor
          listing={{
            id: listing.id,
            title: listing.title ?? "",
            price: listing.price ?? null,
            isPublished: listing.isPublished ?? false,
          }}
          initialMedia={listing.media.map((m) => ({ url: m.url, sortOrder: m.sortOrder }))}
          priceHistory={listing.priceHistory.map((p) => ({
            price: p.price,
            createdAt: p.recordedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
