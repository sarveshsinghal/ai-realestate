// lib/repos/listingsRepo.ts
import { prisma } from "@/lib/prisma";

export type ListingSearchFilters = {
  commune?: string;
  bedrooms?: number; // at least
  minPrice?: number;
  maxPrice?: number;
  minSqm?: number;
};

export async function getAllPublishedListings() {
  return prisma.listing.findMany({
    where: { isPublished: true },
    include: { media: true, agency: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function searchPublishedListings(filters: ListingSearchFilters) {
  const where: any = { isPublished: true };

  if (filters.commune) {
    where.commune = filters.commune;
  }

  if (filters.bedrooms != null) {
    where.bedrooms = { gte: filters.bedrooms };
  }

  if (filters.minSqm != null) {
    where.sizeSqm = { gte: filters.minSqm };
  }

  if (filters.minPrice != null || filters.maxPrice != null) {
    where.price = {};
    if (filters.minPrice != null) where.price.gte = filters.minPrice;
    if (filters.maxPrice != null) where.price.lte = filters.maxPrice;
  }

  return prisma.listing.findMany({
    where,
    include: { media: true, agency: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getListingById(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    include: { media: { orderBy: { sortOrder: "asc" } }, agency: true },
  });
}
