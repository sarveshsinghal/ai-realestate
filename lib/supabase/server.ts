import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Use in Route Handlers / Server Actions ONLY.
 * This client can write cookies (refresh tokens, etc).
 */
export const createSupabaseServer = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
};

/**
 * Use in Server Components (page.tsx, layout.tsx, server utilities called from them).
 * This client is READ-ONLY (no cookie writes).
 */
export const createSupabaseServerReadonly = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Next.js forbids cookie writes in Server Components
        setAll() {},
      },
    }
  );
};