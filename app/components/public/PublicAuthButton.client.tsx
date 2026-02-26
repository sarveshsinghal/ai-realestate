"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function PublicAuthButtonClient() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [mounted, setMounted] = useState(false); // ✅ critical
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setMounted(true); // prevents SSR mismatch

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.session));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload(); // safe refresh
  }

  // 🚀 Prevent hydration mismatch
  if (!mounted) return null;

  if (!signedIn) {
    return (
      <Link
        href="/auth/sign-in"
        className="rounded-full border px-4 py-2 text-sm hover:bg-muted"
      >
        Sign in
      </Link>
    );
  }

  return (
    <button
      onClick={signOut}
      className="rounded-full border px-4 py-2 text-sm hover:bg-muted"
      type="button"
    >
      Sign out
    </button>
  );
}