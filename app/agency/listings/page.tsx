// app/agency/listings/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/requireAgencyContext";

export default async function AgencyListingsPage() {
  const { agency, membership } = await requireAgencyContext();

  const listings = await prisma.listing.findMany({
    where: { agencyId: agency.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      price: true,
      isPublished: true,
      createdAt: true,
    },
  });

  const canCreate = membership.role === "ADMIN" || membership.role === "MANAGER" || membership.role === "AGENT";

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Listings</h1>
          <p className="mt-1 text-sm text-gray-600">Manage your agency listings.</p>
        </div>

        {canCreate ? (
          <Link className="rounded-md bg-black px-4 py-2 text-white" href="/agency/listings/new">
            New listing
          </Link>
        ) : null}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Price</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-gray-600" colSpan={4}>
                  No listings yet.
                </td>
              </tr>
            ) : (
              listings.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-4 py-3">{l.title ?? "(Untitled)"}</td>
                  <td className="px-4 py-3">{typeof l.price === "number" ? l.price.toLocaleString() : "-"}</td>
                  <td className="px-4 py-3">
                    {l.isPublished ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Published</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-800">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link className="text-sm underline" href={`/agency/listings/${l.id}/edit`}>
                        Edit
                      </Link>
                      <Link className="text-sm underline" href={`/listing/${l.id}`}>
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
