import Link from "next/link";
import { LISTINGS } from "@/lib/mockData";
import { ListingCard } from "@/app/components/ListingCard";
import { AISearchBar } from "@/app/components/AISearchBar";

export default function HomePage() {
  const featured = LISTINGS.slice(0, 3);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto p-6 space-y-10">

        {/* Hero */}
        <section className="space-y-4 text-center py-10">
          <h1 className="text-3xl font-bold">
            AI Real Estate Marketplace for Luxembourg
          </h1>
          <p className="text-muted-foreground">
            Smarter property decisions powered by AI insights.
          </p>
          <AISearchBar />

          <div className="flex justify-center gap-4 pt-4">
            <Link
              href="/listings"
              className="px-6 py-3 bg-black text-white rounded-md"
            >
              Explore Listings
            </Link>
            <Link
              href="/agency"
              className="px-6 py-3 border rounded-md"
            >
              Agency Dashboard
            </Link>
          </div>
        </section>

        {/* Featured */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Featured Opportunities</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featured.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
