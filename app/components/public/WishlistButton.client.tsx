"use client";

import WishlistButton from "@/app/components/public/WishlistButton";

export default function WishlistButtonClient({ listingId }: { listingId: string }) {
  return <WishlistButton listingId={listingId} />;
}