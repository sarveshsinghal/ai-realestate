'use client'

import { useState, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export default function LoginPage() {
  const supabase = createSupabaseBrowser()
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const params = useSearchParams()
  const router = useRouter()
  const next = params.get('next') || '/agency'

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (!error) setSent(true)
    })
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>

      <button
        onClick={signInWithGoogle}
        className="w-full rounded border px-4 py-2"
      >
        Continue with Google
      </button>

      <div className="text-sm text-muted-foreground">or</div>

      <form onSubmit={signInWithEmail} className="space-y-2">
        <input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <button
          disabled={pending}
          className="w-full rounded border px-4 py-2"
        >
          Send magic link / OTP
        </button>
      </form>

      {sent && (
        <p className="text-sm">
          Check your email for the sign-in link.
        </p>
      )}
    </main>
  )
}
