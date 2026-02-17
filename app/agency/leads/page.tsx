// app/agency/leads/page.tsx
import { prisma } from "@/lib/prisma";
import { requireAgencyContext } from "@/lib/auth-server";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("de-LU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function AgencyLeadsPage() {
  // 🔐 Enforce auth + agency membership
  const { agency } = await requireAgencyContext();

  const leads = await prisma.lead.findMany({
    where: {
      agencyId: agency.id, // ✅ Multi-tenant scoping
    },
    orderBy: { createdAt: "desc" },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          commune: true,
          price: true,
        },
      },
    },
    take: 200,
  });

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          Leads — {agency.name}
        </h1>
        <p className="text-muted-foreground">
          Incoming inquiries from your agency listings.
        </p>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3">Date</th>
              <th className="p-3">Listing</th>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 whitespace-nowrap">
                  {formatDate(l.createdAt)}
                </td>

                <td className="p-3">
                  <div className="font-medium">
                    {l.listing?.title ?? "—"}
                  </div>
                  <div className="text-muted-foreground">
                    {l.listing?.commune ?? ""}{" "}
                    {l.listing?.price
                      ? `• €${l.listing.price.toLocaleString("de-LU")}`
                      : ""}
                  </div>
                </td>

                <td className="p-3">{l.name}</td>
                <td className="p-3">{l.email}</td>
                <td className="p-3">{l.phone ?? "—"}</td>

                <td className="p-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-md border">
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}

            {leads.length === 0 && (
              <tr>
                <td className="p-6 text-muted-foreground" colSpan={6}>
                  No leads yet for this agency.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
