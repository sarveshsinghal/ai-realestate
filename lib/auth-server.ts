import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MemberRole } from "@prisma/client";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function requireAgencyContext() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login?next=/agency");
  }

  const supaUser = data.user;

  // 1️⃣ Ensure internal User exists
  let user = await prisma.user.findUnique({
    where: { supabaseUserId: supaUser.id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        supabaseUserId: supaUser.id,
        email: supaUser.email ?? null,
        name: (supaUser.user_metadata as any)?.full_name ?? null,
      },
    });
  }

  // 2️⃣ Check membership
  let membership = await prisma.agencyMember.findFirst({
    where: { supabaseUserId: supaUser.id },
    include: { agency: true },
  });

  if (!membership) {
    // ✅ Guardrail: if there is exactly one agency in DB, attach user to it (dev-friendly)
    const agenciesCount = await prisma.agency.count();

    if (agenciesCount === 1) {
      const existingAgency = await prisma.agency.findFirst({
        select: { id: true },
      });

      if (existingAgency) {
        membership = await prisma.agencyMember.create({
          data: {
            agencyId: existingAgency.id,
            userId: user.id,
            supabaseUserId: supaUser.id,
            email: supaUser.email ?? "",
            role: MemberRole.ADMIN,
          },
          include: { agency: true },
        });

        return {
          supabaseUser: supaUser,
          user,
          membership,
          agency: membership.agency,
        };
      }
    }

    // Otherwise create a new agency (normal behavior)
    const baseName =
      (supaUser.user_metadata as any)?.full_name ??
      supaUser.email?.split("@")[0] ??
      "My Agency";

    const slugBase = slugify(baseName);

    const agency = await prisma.agency.create({
      data: {
        name: `${baseName} Agency`,
        slug: `${slugBase}-${Date.now()}`,
      },
    });

    membership = await prisma.agencyMember.create({
      data: {
        agencyId: agency.id,
        userId: user.id,
        supabaseUserId: supaUser.id,
        email: supaUser.email ?? "",
        role: MemberRole.ADMIN,
      },
      include: { agency: true },
    });
  }

  return {
    supabaseUser: supaUser,
    user,
    membership,
    agency: membership.agency,
  };
}
