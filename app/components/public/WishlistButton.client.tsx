"use client";

import { useEffect, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function WishlistButtonClient({
  listingId,
  initialSaved = false,
}: {
  listingId: string;
  initialSaved?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [saved, setSaved] = useState<boolean>(Boolean(initialSaved));
  const [pending, startTransition] = useTransition();

  // Keep state in sync if parent passes updated value
  useEffect(() => {
    setSaved(Boolean(initialSaved));
  }, [initialSaved]);

  function goSignIn() {
    const cb = pathname || "/listings";
    router.push(`/auth/sign-in?callbackUrl=${encodeURIComponent(cb)}`);
  }

  async function doToggle(next: boolean) {
    const res = await fetch(
      next ? "/api/wishlist" : `/api/wishlist/${encodeURIComponent(listingId)}`,
      {
        method: next ? "POST" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ listingId }) : undefined,
      }
    );

    if (res.status === 401) return "UNAUTH";
    if (!res.ok) return "FAIL";
    return "OK";
  }

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    // prevent clicking heart from navigating the parent <Link>
    e.preventDefault();
    e.stopPropagation();

    if (pending) return;

    startTransition(async () => {
      const next = !saved;

      // optimistic UI
      setSaved(next);

      const result = await doToggle(next);

      if (result === "UNAUTH") {
        setSaved(false);
        toast.error("Please sign in to save listings.");
        goSignIn();
        return;
      }

      if (result === "FAIL") {
        setSaved(!next);
        toast.error("Could not update wishlist.");
        return;
      }

      // notify header count
      try {
        window.dispatchEvent(new Event("wishlist:changed"));
      } catch {}

      toast.success(next ? "Saved to wishlist" : "Removed from saved");
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background/90 backdrop-blur transition",
        "hover:scale-105",
        pending && "opacity-70",
        saved ? "border-red-200" : "border-border"
      )}
      aria-label={saved ? "Remove from saved" : "Save listing"}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition",
          saved
            ? "fill-red-500 stroke-red-500"
            : "stroke-muted-foreground fill-transparent"
        )}
      />
    </button>
  );
}