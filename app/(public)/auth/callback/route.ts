import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/wishlist";

  const supabase = await createSupabaseServer();

  // Ensure session cookie is established (with @supabase/ssr)
  await supabase.auth.getUser();

  return NextResponse.redirect(new URL(next, url.origin));
}