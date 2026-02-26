import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSupabaseServer,
  createSupabaseServerReadonly,
} from "@/lib/supabase/server";

export type UserContext = {
  userId: string; // internal User.id
  supabaseUserId: string; // auth uuid
};

// ✅ Route Handlers only (can set cookies)
export async function requireUserContext(): Promise<UserContext> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  const supabaseUserId = data?.user?.id ?? null;

  if (error || !supabaseUserId) {
    throw NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const user =
    (await prisma.user.findUnique({
      where: { supabaseUserId },
      select: { id: true },
    })) ??
    (await prisma.user.create({
      data: { supabaseUserId },
      select: { id: true },
    }));

  return { userId: user.id, supabaseUserId };
}

// ✅ Server Components safe (NO cookie writes)
export async function getUserContext(): Promise<UserContext | null> {
  try {
    const supabase = await createSupabaseServerReadonly();
    const { data } = await supabase.auth.getUser();

    const supabaseUserId = data?.user?.id ?? null;
    if (!supabaseUserId) return null;

    const user =
      (await prisma.user.findUnique({
        where: { supabaseUserId },
        select: { id: true },
      })) ??
      (await prisma.user.create({
        data: { supabaseUserId },
        select: { id: true },
      }));

    return { userId: user.id, supabaseUserId };
  } catch {
    return null;
  }
}