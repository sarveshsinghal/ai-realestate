import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/requireUserContext";
import WishlistClient from "./_components/WishlistClient";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent("/wishlist")}`);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Saved listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your saved listings appear here. Remove anytime.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/listings"
            className="inline-flex h-10 items-center justify-center rounded-full border bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            Browse listings
          </Link>
        </div>
      </div>

      <WishlistClient />
    </div>
  );
}