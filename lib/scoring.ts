import { COMMUNE_AVG_PRICE_PSM } from "./communePricing";
import type { Listing } from "./mockData";

export type DealGrade = "A" | "B" | "C";
export type DealScore = {
  grade: DealGrade;
  score: number; // 0..100
  pricePerSqm: number;
  communeAvg: number | null;
  vsAvgPct: number | null; // negative means cheaper than avg
  estMonthlyRent: number;
  estGrossYieldPct: number;
  reasons: string[];
};

export function pricePerSqm(listing: Listing): number {
  return Math.round(listing.price / listing.sizeSqm);
}

// very rough Luxembourg heuristic for MVP; we’ll improve later using data
export function estimateMonthlyRent(listing: Listing): number {
  const base = 24; // €/sqm baseline
  const conditionBoost =
    listing.condition === "New" ? 8 :
    listing.condition === "Renovated" ? 5 :
    listing.condition === "Good" ? 2 :
    -2;

  const communeBoost =
    listing.commune === "Kirchberg" ? 6 :
    listing.commune === "Belair" ? 6 :
    listing.commune === "Limpertsberg" ? 5 :
    listing.commune === "Gare" ? 2 :
    listing.commune === "Esch-sur-Alzette" ? -3 :
    0;

  const est = (base + conditionBoost + communeBoost) * listing.sizeSqm;
  return Math.round(est / 10) * 10; // round to nearest 10
}

export function estimateGrossYieldPct(listing: Listing): number {
  const rent = estimateMonthlyRent(listing);
  const annual = rent * 12;
  return Math.round((annual / listing.price) * 1000) / 10; // 1 decimal
}

export function dealScore(listing: Listing): DealScore {
  const psm = pricePerSqm(listing);
  const communeAvg = COMMUNE_AVG_PRICE_PSM[listing.commune] ?? null;

  const vsAvgPct = communeAvg ? Math.round(((psm - communeAvg) / communeAvg) * 1000) / 10 : null;

  const rent = estimateMonthlyRent(listing);
  const yieldPct = estimateGrossYieldPct(listing);

  const reasons: string[] = [];

  // price score: cheaper than avg is good
  let priceScore = 50;
  if (communeAvg && vsAvgPct !== null) {
    if (vsAvgPct <= -10) { priceScore = 80; reasons.push("Priced well below commune average."); }
    else if (vsAvgPct <= -3) { priceScore = 65; reasons.push("Slightly below commune average."); }
    else if (vsAvgPct < 3) { priceScore = 50; reasons.push("Close to commune average."); }
    else if (vsAvgPct < 10) { priceScore = 35; reasons.push("Slightly above commune average."); }
    else { priceScore = 20; reasons.push("Significantly above commune average."); }
  } else {
    reasons.push("Commune average unavailable — score is approximate.");
  }

  // yield score
  let yieldScore = 40;
  if (yieldPct >= 4.5) { yieldScore = 75; reasons.push("Strong estimated gross yield."); }
  else if (yieldPct >= 3.5) { yieldScore = 55; reasons.push("Decent estimated gross yield."); }
  else { yieldScore = 30; reasons.push("Lower estimated gross yield."); }

  // condition score
  const condScore =
    listing.condition === "New" ? 80 :
    listing.condition === "Renovated" ? 70 :
    listing.condition === "Good" ? 55 :
    35;

  if (listing.condition === "To renovate") reasons.push("Renovation required — budget accordingly.");

  // energy bonus
  const energyScore =
    listing.energyClass === "A" ? 75 :
    listing.energyClass === "B" ? 65 :
    listing.energyClass === "C" ? 55 :
    listing.energyClass === "D" ? 45 :
    listing.energyClass === "E" ? 35 : 25;

  // weighted final
  const score = Math.round(
    0.45 * priceScore +
    0.25 * yieldScore +
    0.20 * condScore +
    0.10 * energyScore
  );

  const grade: DealGrade = score >= 70 ? "A" : score >= 50 ? "B" : "C";

  if (grade === "A") reasons.unshift("High-value opportunity based on current heuristics.");
  if (grade === "C") reasons.unshift("Proceed carefully — value signals are weaker.");

  return {
    grade,
    score,
    pricePerSqm: psm,
    communeAvg,
    vsAvgPct,
    estMonthlyRent: rent,
    estGrossYieldPct: yieldPct,
    reasons: reasons.slice(0, 5),
  };
}
