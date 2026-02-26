"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function WishlistButton({
  listingId,
  initialSaved = false,
  className,
}: {
  listingId: string;
  initialSaved?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function goSignin() {
    router.push(`/signin?callbackUrl=${encodeURIComponent(pathname || "/")}`);
  }

  async function toggle() {
    startTransition(async () => {
      const next = !saved;
      setSaved(next);

      try {
        const res = await fetch(next ? "/api/wishlist" : `/api/wishlist/${listingId}`, {
          method: next ? "POST" : "DELETE",
          headers: next ? { "content-type": "application/json" } : undefined,
          body: next ? JSON.stringify({ listingId }) : undefined,
        });

        if (res.status === 401) {
          setSaved(false);
          goSignin();
          return;
        }

        if (!res.ok) {
          setSaved(!next);
        }
      } catch {
        setSaved(!next);
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      className={[
        "inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background/80 backdrop-blur hover:bg-muted",
        pending ? "opacity-60" : "",
        className ?? "",
      ].join(" ")}
    >
      <span className="text-lg leading-none">{saved ? "♥" : "♡"}</span>
    </button>
  );
}