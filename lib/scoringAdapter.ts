import type { ListingCondition, EnergyClass } from "@prisma/client";
import type { Listing as ScoringListing } from "@/lib/mockData";

export function toScoringListing(input: {
  id: string;
  title: string;
  commune: string;
  price: number;
  sizeSqm: number;
  bedrooms: number;
  bathrooms: number;
  condition: ListingCondition;
  energyClass: EnergyClass;
}): ScoringListing {
  const condition: ScoringListing["condition"] =
    input.condition === "NEW"
      ? "New"
      : input.condition === "RENOVATED"
        ? "Renovated"
        : input.condition === "GOOD"
          ? "Good"
          : "To renovate";

  const energyClass: ScoringListing["energyClass"] =
    input.energyClass === "A"
      ? "A"
      : input.energyClass === "B"
        ? "B"
        : input.energyClass === "C"
          ? "C"
          : input.energyClass === "D"
            ? "D"
            : input.energyClass === "E"
              ? "E"
              : "F";

  return {
    id: input.id,
    title: input.title,
    commune: input.commune,
    price: input.price,
    sizeSqm: input.sizeSqm,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    condition,
    energyClass,
    media: [], // required by ScoringListing type
  };
}
