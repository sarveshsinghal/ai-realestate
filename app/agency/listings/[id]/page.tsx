import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";
import { notFound } from "next/navigation";

export default async function AgencyListingManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { agency } = await requireAgencyContext();
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      commune: true,
      price: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,
      isPublished: true,

      // ✅ NEW: lifecycle fields
      status: true,
      soldAt: true,

      agencyId: true,
      createdAt: true,
    },
  });

  if (!listing || listing.agencyId !== agency.id) notFound();

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Manage listing</h1>
        <p className="text-muted-foreground">{listing.title}</p>
      </div>

      <div className="border rounded-md p-4 space-y-2">
        <div className="text-sm text-muted-foreground">Details</div>
        <div>
          <div className="font-medium">{listing.commune}</div>
          <div className="text-muted-foreground">
            €{listing.price.toLocaleString("de-LU")} • {listing.bedrooms}BR •{" "}
            {listing.sizeSqm} sqm
          </div>
        </div>

        <div className="pt-2 text-sm text-muted-foreground space-y-1">
          <div>
            Publish state: {listing.isPublished ? "Published" : "Draft"}
          </div>

          <div>
            Availability:{" "}
            <span className="font-medium">{listing.status}</span>
            {listing.soldAt && (
              <span className="ml-2 text-xs text-muted-foreground">
                (since{" "}
                {new Date(listing.soldAt).toLocaleDateString("de-LU", {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                })}
                )
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ✅ NEW: Availability actions (simple MVP using POST forms) */}
      <div className="border rounded-md p-4 space-y-3">
        <div className="text-sm text-muted-foreground">Availability actions</div>

        <div className="flex flex-wrap gap-2">
          <form action={`/api/listings/${listing.id}/status`} method="post">
            <input type="hidden" name="status" value="ACTIVE" />
            <button
              type="submit"
              className="px-3 py-1 rounded-md border text-sm hover:bg-accent"
            >
              Mark Active
            </button>
          </form>

          <form action={`/api/listings/${listing.id}/status`} method="post">
            <input type="hidden" name="status" value="SOLD" />
            <input type="hidden" name="soldReason" value="sold" />
            <button
              type="submit"
              className="px-3 py-1 rounded-md border text-sm hover:bg-accent"
            >
              Mark Sold
            </button>
          </form>

          <form action={`/api/listings/${listing.id}/status`} method="post">
            <input type="hidden" name="status" value="UNAVAILABLE" />
            <button
              type="submit"
              className="px-3 py-1 rounded-md border text-sm hover:bg-accent"
            >
              Mark Unavailable
            </button>
          </form>

          <form action={`/api/listings/${listing.id}/status`} method="post">
            <input type="hidden" name="status" value="ARCHIVED" />
            <button
              type="submit"
              className="px-3 py-1 rounded-md border text-sm hover:bg-accent"
            >
              Archive
            </button>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">
          Sold/unavailable listings will be auto-archived after 7 days (once the
          scheduled job is enabled).
        </p>
      </div>

      <div className="flex gap-3">
        <Link className="underline" href="/agency/listings">
          Back to listings
        </Link>
        <Link className="underline" href={`/listing/${listing.id}`}>
          View public
        </Link>
      </div>

      <div className="text-sm text-muted-foreground">
        Next: edit form, media management, pricing history, and AI
        recommendations.
      </div>
    </main>
  );
}