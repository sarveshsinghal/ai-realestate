'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut()
        router.push('/login')
      }}
      className="rounded border px-3 py-1 text-sm"
    >
      Logout
    </button>
  )
}
