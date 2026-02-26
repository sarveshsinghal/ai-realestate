"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function PublicSignInPage() {
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") || "/wishlist";
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signInWithGoogle() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          callbackUrl
        )}`,
      },
    });
    if (error) setErr(error.message);
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          callbackUrl
        )}`,
      },
    });

    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Sign in to save listings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Browsing and contacting agencies is open. Sign in only to save and revisit listings.
      </p>

      <div className="mt-6 space-y-3">
        <button
          onClick={signInWithGoogle}
          className="w-full rounded-2xl border bg-background px-4 py-3 text-sm font-medium hover:bg-muted"
          type="button"
        >
          Continue with Google
        </button>

        <div className="text-center text-xs text-muted-foreground">or</div>

        <form onSubmit={signInWithEmail} className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email for magic link"
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600/30"
            type="email"
            required
          />
          <button
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            type="submit"
            disabled={!email || sent}
          >
            {sent ? "Magic link sent" : "Send magic link"}
          </button>
        </form>

        {sent ? (
          <div className="rounded-2xl border bg-background p-3 text-sm">
            Check your email for the sign-in link.
          </div>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {err}
          </div>
        ) : null}
      </div>
    </div>
  );
}