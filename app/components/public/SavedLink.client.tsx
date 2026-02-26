"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function SavedLinkClient() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [mounted, setMounted] = useState(false); // ✅ critical
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [count, setCount] = useState<number>(0);

  async function refreshCount() {
    try {
      const res = await fetch("/api/wishlist/count", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCount(typeof data?.count === "number" ? data.count : 0);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setMounted(true); // ✅ prevents hydration mismatch

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const has = Boolean(data.session);
      setSignedIn(has);
      if (has) void refreshCount();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const has = Boolean(session);
      setSignedIn(has);
      if (has) void refreshCount();
      else setCount(0);
    });

    const onChanged = () => {
      void refreshCount();
    };
    window.addEventListener("wishlist:changed", onChanged);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("wishlist:changed", onChanged);
    };
  }, [supabase]);

  // 🚀 Prevent SSR mismatch
  if (!mounted) return null;
  if (!signedIn) return null;

  return (
    <Link
      href="/wishlist"
      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-muted"
    >
      <Heart className="h-4 w-4" />
      <span>Saved</span>
      <span className="rounded-full border px-2 py-0.5 text-xs tabular-nums">
        {count}
      </span>
    </Link>
  );
}