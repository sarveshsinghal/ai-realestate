// lib/supabase/admin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

export function createSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  // Prefer public URL env (commonly present), fall back to SUPABASE_URL if you have it
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    mustGetEnv("NEXT_PUBLIC_SUPABASE_URL");

  const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
